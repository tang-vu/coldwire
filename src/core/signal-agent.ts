/**
 * Coldwire signal agent — the on-device pipeline.
 *
 *   read private docs -> embed + ingest (RAG) -> per-asset retrieve + reason
 *   -> portfolio review -> assemble structured SignalReport (+ on-device proof)
 *
 * Every embedding and every completion runs locally via @qvac/sdk. The only
 * network activity is the SDK's one-time model download inside loadModel.
 */

import os from "node:os";
import {
  loadLLM,
  loadEmbedModel,
  unload,
  enableProfiler,
  profilerSummary,
  generateStructured,
  type ModelProgress,
} from "./qvac-models.ts";
import {
  readPrivateDocs,
  extractAssetUniverse,
  extractAssetNotes,
  getDocByHint,
} from "./private-doc-parsing.ts";
import {
  ingestPrivateDocs,
  retrieveForAsset,
  retrieveRules,
  retrievePortfolio,
  closePrivateWorkspace,
  type RetrievedChunk,
} from "./rag-private-context.ts";
import {
  ASSET_SIGNAL_JSON_SCHEMA,
  PORTFOLIO_VIEW_JSON_SCHEMA,
  parseJsonLoose,
  normalizeSignal,
  type AssetSignal,
  type SignalReport,
  type RawAssetSignal,
  type PortfolioView,
  type InferenceStat,
} from "./signal-report-schema.ts";
import {
  SIGNAL_SYSTEM_PROMPT,
  buildAssetUserPrompt,
  PORTFOLIO_SYSTEM_PROMPT,
  buildPortfolioUserPrompt,
} from "./signal-prompts.ts";
import { parseStatedBias, reconcileWithBias } from "./bias-grounding.ts";

export interface AgentEvents {
  onPhase?: (phase: string) => void;
  onAsset?: (ticker: string, index: number, total: number) => void;
  onModelDownload?: (label: string, p: ModelProgress) => void;
}

export interface AgentOptions {
  dataDir: string;
  events?: AgentEvents;
}

const snippet = (c: RetrievedChunk): string =>
  c.content.replace(/\s+/g, " ").trim().slice(0, 110);

export async function generateSignalReport(opts: AgentOptions): Promise<SignalReport> {
  const { dataDir, events } = opts;
  enableProfiler();

  events?.onPhase?.("Loading embedding model (GTE-large, 1024-d)");
  const embedId = await loadEmbedModel((p) => events?.onModelDownload?.("embeddings", p));
  events?.onPhase?.("Loading LLM (Llama 3.2 1B Instruct)");
  const llmId = await loadLLM((p) => events?.onModelDownload?.("llm", p));

  try {
    events?.onPhase?.("Reading private docs");
    const docs = await readPrivateDocs(dataDir);
    const assets = extractAssetUniverse(docs);
    if (assets.length === 0) {
      throw new Error("No assets found. Expected '## TICKER — Name' headings in a watchlist doc.");
    }

    events?.onPhase?.(`Embedding + ingesting ${docs.length} docs into local RAG`);
    await ingestPrivateDocs(embedId, docs);

    events?.onPhase?.("Retrieving strategy/risk rules via embeddings");
    const rules = await retrieveRules(embedId);

    const stats: InferenceStat[] = [];
    const signals: AssetSignal[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      events?.onAsset?.(asset.ticker, i + 1, assets.length);
      const assetCtx = await retrieveForAsset(embedId, asset);
      const primaryNotes = extractAssetNotes(docs, asset);
      try {
        const { data, stat } = await generateStructured<RawAssetSignal>({
          llmId,
          system: SIGNAL_SYSTEM_PROMPT,
          user: buildAssetUserPrompt(asset, primaryNotes, assetCtx, rules),
          schema: ASSET_SIGNAL_JSON_SCHEMA as unknown as Record<string, unknown>,
          schemaName: "asset_signal",
          label: `signal:${asset.ticker}`,
          parse: (t) => normalizeSignal(parseJsonLoose<RawAssetSignal>(t)),
        });
        stats.push(stat);
        // Guarantee the stance/conviction never contradicts the user's stated bias.
        const grounded = reconcileWithBias(parseStatedBias(primaryNotes), primaryNotes, data);
        // Lead provenance with the asset's own note (strongest grounding), then RAG chunks.
        const primarySnippet = primaryNotes.replace(/\s+/g, " ").trim().slice(0, 110);
        const sources = [primarySnippet, ...assetCtx.map(snippet)].filter(Boolean);
        signals.push({ ...grounded, asset: asset.ticker, sources });
      } catch (err) {
        // Isolate per-asset failures so the report still completes.
        signals.push({
          asset: asset.ticker,
          stance: "neutral",
          conviction: 3,
          thesis: `Could not generate a structured signal (${(err as Error).message}).`,
          risk: "Signal unavailable — treat as no-information, do not act.",
          suggestedAction: "Re-run; if it persists, inspect the model output.",
          sources: assetCtx.map(snippet),
        });
      }
    }

    events?.onPhase?.("Reviewing portfolio against rules");
    // Prefer the exact positions doc; fall back to RAG retrieval if absent.
    let positionsText = getDocByHint(docs, "position");
    if (!positionsText.trim()) {
      const portfolioCtx = await retrievePortfolio(embedId);
      positionsText = portfolioCtx.map((c) => c.content).join("\n\n");
    }
    const { data: portfolio, stat: portfolioStat } = await generateStructured<PortfolioView>({
      llmId,
      system: PORTFOLIO_SYSTEM_PROMPT,
      user: buildPortfolioUserPrompt(rules, positionsText),
      schema: PORTFOLIO_VIEW_JSON_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "portfolio_view",
      label: "portfolio",
      parse: (t) => {
        const p = parseJsonLoose<PortfolioView>(t);
        return {
          portfolioSummary: String(p.portfolioSummary ?? "").trim() || "No summary produced.",
          keyRisks: Array.isArray(p.keyRisks) ? p.keyRisks.map(String).filter(Boolean) : [],
        };
      },
    });
    stats.push(portfolioStat);

    return {
      generatedAt: new Date().toISOString(),
      llmModel: "LLAMA_3_2_1B_INST_Q4_0",
      embedModel: "GTE_LARGE_FP16",
      dataDir,
      assetCount: assets.length,
      portfolio,
      signals,
      proof: {
        onDevice: true,
        host: os.hostname(),
        stats,
        profilerSummary: profilerSummary(),
      },
    };
  } finally {
    await closePrivateWorkspace(true).catch(() => {});
    await unload(llmId).catch(() => {});
    await unload(embedId).catch(() => {});
  }
}
