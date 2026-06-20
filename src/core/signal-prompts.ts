/**
 * Prompt templates for the Coldwire signal agent.
 *
 * The system prompt hard-frames the model as an on-device, private-context-only
 * reasoner. User prompts inject the asset's EXACT notes (primary) plus
 * RAG-retrieved related context, so the model can't drift from the trader's
 * stated view — critical for a small 1B model.
 */

import type { RetrievedChunk } from "./rag-private-context.ts";
import type { Asset } from "./private-doc-parsing.ts";

export const SIGNAL_SYSTEM_PROMPT = [
  "You are Coldwire, a 100% on-device private alpha agent for a crypto trader.",
  "You reason ONLY over the private notes provided in each request — never external",
  "knowledge, never live market data, never invented prices.",
  "You never contradict the trader's own stated bias or rules.",
  "You are concise, specific and risk-first.",
  "You ALWAYS return strictly valid JSON matching the requested schema, with no prose outside the JSON.",
].join(" ");

function renderChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(none retrieved)";
  return chunks.map((c, i) => `[${i + 1}] ${c.content.trim()}`).join("\n\n");
}

export function buildAssetUserPrompt(
  asset: Asset,
  primaryNotes: string,
  related: RetrievedChunk[],
  rules: RetrievedChunk[],
): string {
  return [
    `Score the asset ${asset.ticker} (${asset.name}).`,
    "",
    `MY NOTES ON ${asset.ticker} (PRIMARY — weight these above everything else):`,
    primaryNotes.trim() || "(no specific notes found)",
    "",
    "RELATED CONTEXT retrieved from my other notes:",
    renderChunks(related),
    "",
    "MY RISK RULES / CONVICTION FRAMEWORK:",
    renderChunks(rules),
    "",
    `Produce a JSON signal for ${asset.ticker} with fields:`,
    "- stance: one of bullish | bearish | neutral | accumulate | reduce | avoid",
    "- conviction: integer 1-5 per MY framework (5 = full size within rules, 1 = avoid)",
    "- thesis: 1-2 sentences, grounded ONLY in MY notes on this asset",
    "- risk: the single biggest risk or what invalidates the idea, from MY notes",
    "- suggestedAction: one concrete next step for THIS asset, consistent with my rules",
    "",
    "Set `stance` from MY stated bias in the notes (this drives stance, not the risk):",
    '- "constructive" / "bullish" / "high-beta long" -> bullish',
    '- "accumulate on weakness" -> accumulate',
    '- "neutral" / "neutral-to-bullish" -> neutral',
    '- "cautious" -> neutral (or reduce if I am underwater / broke a rule to enter)',
    '- "avoid" / "sentiment" -> avoid',
    "- If I am long but the position breaches one of my caps (oversized), stance = reduce.",
    "conviction is 1-5 per my framework; avoid/sentiment assets MUST be 1-2.",
    `Talk only about ${asset.ticker}; do not mention other tickers' sizes. Do not invent prices.`,
  ].join("\n");
}

export const PORTFOLIO_SYSTEM_PROMPT = [
  "You are Coldwire, a 100% on-device private alpha agent.",
  "You reason ONLY over the trader's private portfolio + strategy notes provided.",
  "You surface concrete rule breaches with the actual numbers.",
  "You return strictly valid JSON matching the schema, no prose outside the JSON.",
].join(" ");

export function buildPortfolioUserPrompt(
  rules: RetrievedChunk[],
  positions: string,
): string {
  return [
    "Review MY portfolio against MY rules and surface the most important issues.",
    "",
    "MY STRATEGY & RISK RULES (caps and limits):",
    renderChunks(rules),
    "",
    "MY POSITIONS:",
    positions.trim() || "(no positions doc found)",
    "",
    "Produce JSON with fields:",
    "- portfolioSummary: 1-2 sentences on overall posture and the single biggest tension vs my rules",
    "- keyRisks: array of 2-5 CONCRETE rule breaches or risks, each citing the actual number",
    "  (e.g. 'SOL is 36% of NAV, above my 25% single-alt cap'; 'total alt exposure 53.7% > 50% cap';",
    "  'ARB bought into an unlock, violating my own rule'). Do NOT just list positions.",
    "Base everything ONLY on my notes. Be specific and quote my numbers.",
  ].join("\n");
}
