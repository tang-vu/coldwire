/**
 * Private-context RAG over the trader's own docs, using QVAC embeddings.
 *
 * Docs are embedded on-device with GTE-large and stored in a local HyperDB
 * workspace. Per-asset / per-rules retrieval grounds signals in the user's
 * real notes — which never leave the machine. Pairs with exact-section notes
 * from private-doc-parsing for hybrid (lexical + semantic) grounding.
 */

import { ragIngest, ragSearch, ragCloseWorkspace } from "@qvac/sdk";
import {
  RAG_WORKSPACE,
  RAG_CHUNK_OPTS,
  RAG_TOP_K_ASSET,
  RAG_TOP_K_RULES,
} from "./coldwire-config.ts";
import type { Asset, PrivateDoc } from "./private-doc-parsing.ts";

export interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
}

/** Embed + store all private docs in the RAG workspace. */
export async function ingestPrivateDocs(
  embedId: string,
  docs: PrivateDoc[],
): Promise<{ chunks: number }> {
  const documents = docs.map((d) => `Source: ${d.name}\n\n${d.content}`);
  const result = await ragIngest({
    modelId: embedId,
    documents,
    chunk: true,
    chunkOpts: RAG_CHUNK_OPTS,
    workspace: RAG_WORKSPACE,
  });
  return { chunks: result.processed.length };
}

function toChunks(results: { id: string; content: string; score: number }[]): RetrievedChunk[] {
  return results.map((r) => ({ id: r.id, content: r.content, score: r.score }));
}

/** Retrieve the private context most relevant to a single asset. */
export async function retrieveForAsset(embedId: string, asset: Asset): Promise<RetrievedChunk[]> {
  const results = await ragSearch({
    modelId: embedId,
    query: `${asset.ticker} ${asset.name} thesis position size risk catalyst key levels invalidation`,
    topK: RAG_TOP_K_ASSET,
    workspace: RAG_WORKSPACE,
  });
  return toChunks(results);
}

/** Retrieve the trader's strategy/risk rules (the conviction rubric). */
export async function retrieveRules(embedId: string): Promise<RetrievedChunk[]> {
  const results = await ragSearch({
    modelId: embedId,
    query:
      "conviction framework position sizing risk management rules cash reserve alt exposure cap concentration guardrails",
    topK: RAG_TOP_K_RULES,
    workspace: RAG_WORKSPACE,
  });
  return toChunks(results);
}

/** Retrieve portfolio-level context (positions, weights, exposure, cash). */
export async function retrievePortfolio(embedId: string): Promise<RetrievedChunk[]> {
  const results = await ragSearch({
    modelId: embedId,
    query:
      "open positions size weight unrealized profit loss stop NAV cash reserve concentration total alt exposure cap",
    topK: RAG_TOP_K_RULES + 2,
    workspace: RAG_WORKSPACE,
  });
  return toChunks(results);
}

/** Release the workspace. `deleteOnClose` keeps runs clean + reproducible. */
export async function closePrivateWorkspace(deleteOnClose = true): Promise<void> {
  await ragCloseWorkspace({ workspace: RAG_WORKSPACE, deleteOnClose });
}
