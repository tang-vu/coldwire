/**
 * Structured signal-report schema + types.
 *
 * The JSON schemas here are handed to the QVAC SDK via
 * `completion({ responseFormat: { type: "json_schema", json_schema } })`.
 * llama.cpp converts them to a GBNF grammar and constrains generation on-device,
 * so the model is forced to emit valid JSON in this exact shape — no fragile
 * free-text parsing.
 *
 * Note: the SDK's `strict` flag does NOT auto-tighten, so we encode
 * `required` + `additionalProperties: false` explicitly, and still
 * defensively validate/normalize in TS (grammars don't enforce numeric ranges).
 */

export const STANCES = [
  "bullish",
  "bearish",
  "neutral",
  "accumulate",
  "reduce",
  "avoid",
] as const;

export type Stance = (typeof STANCES)[number];

/** One asset's signal as produced by the model (pre-normalization). */
export interface RawAssetSignal {
  stance: Stance;
  conviction: number;
  thesis: string;
  risk: string;
  suggestedAction: string;
}

/** One asset's signal after normalization + provenance attached. */
export interface AssetSignal extends RawAssetSignal {
  asset: string;
  /** Source doc ids/snippets retrieved via RAG that grounded this signal. */
  sources: string[];
}

export interface PortfolioView {
  portfolioSummary: string;
  keyRisks: string[];
}

/** Per-call inference telemetry, surfaced as on-device proof. */
export interface InferenceStat {
  label: string;
  backendDevice?: string;
  tokensPerSecond?: number;
  promptTokens?: number;
  generatedTokens?: number;
  timeToFirstTokenMs?: number;
}

export interface SignalReport {
  generatedAt: string;
  llmModel: string;
  embedModel: string;
  dataDir: string;
  assetCount: number;
  portfolio: PortfolioView;
  signals: AssetSignal[];
  /** On-device proof: where inference ran + throughput, plus profiler summary. */
  proof: {
    onDevice: true;
    host: string;
    stats: InferenceStat[];
    profilerSummary: string;
  };
}

/** JSON schema for a single asset signal (one constrained completion per asset). */
export const ASSET_SIGNAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stance", "conviction", "thesis", "risk", "suggestedAction"],
  properties: {
    stance: { type: "string", enum: [...STANCES] },
    conviction: { type: "integer" },
    thesis: { type: "string" },
    risk: { type: "string" },
    suggestedAction: { type: "string" },
  },
} as const;

/** JSON schema for the portfolio-level view. */
export const PORTFOLIO_VIEW_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["portfolioSummary", "keyRisks"],
  properties: {
    portfolioSummary: { type: "string" },
    keyRisks: { type: "array", items: { type: "string" } },
  },
} as const;

/**
 * Tolerant JSON extractor — the grammar should yield clean JSON, but small
 * models occasionally wrap output in ```json fences or add stray prose.
 */
export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in model output: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/** Clamp/validate a raw signal into safe bounds. Grammars don't enforce ranges. */
export function normalizeSignal(raw: Partial<RawAssetSignal>): RawAssetSignal {
  const stance: Stance = STANCES.includes(raw.stance as Stance)
    ? (raw.stance as Stance)
    : "neutral";
  let conviction = Math.round(Number(raw.conviction));
  if (!Number.isFinite(conviction)) conviction = 3;
  conviction = Math.min(5, Math.max(1, conviction));
  return {
    stance,
    conviction,
    thesis: String(raw.thesis ?? "").trim() || "No thesis produced.",
    risk: String(raw.risk ?? "").trim() || "No risk produced.",
    suggestedAction: String(raw.suggestedAction ?? "").trim() || "No action produced.",
  };
}
