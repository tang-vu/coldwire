/**
 * Deterministic bias-grounding.
 *
 * A small 1B model writes good thesis/risk/action prose but mis-classifies the
 * discrete stance/conviction. The trader's notes already state an explicit
 * "Bias:" per asset, so we treat that as ground truth: the agent must never
 * contradict the user's own stated view. The LLM still produces all the
 * reasoning text; this layer only reconciles the classification.
 */

import type { RawAssetSignal, Stance } from "./signal-report-schema.ts";

export type StatedBias = "avoid" | "accumulate" | "bullish" | "cautious" | "neutral" | "unknown";

/** Read the explicit `Bias:` line from an asset's notes (falls back to whole text). */
export function parseStatedBias(notes: string): StatedBias {
  const m = notes.match(/Bias:\s*([^\n]*)/i);
  const text = (m ? m[1] : notes).toLowerCase();
  if (/\bavoid\b|sentiment/.test(text)) return "avoid";
  if (/accumulate/.test(text)) return "accumulate";
  if (/\bneutral\b/.test(text)) return "neutral"; // catches "neutral-to-bullish" -> neutral
  if (/constructive|bullish|high-beta|\blong\b|conviction/.test(text)) return "bullish";
  if (/cautious|careful|\bweak\b/.test(text)) return "cautious";
  return "unknown";
}

/** A position the user flags as oversized / breaching a cap should be trimmed. */
const TRIM_SIGNAL = /oversized|too big|concentration risk|above my [^.\n]*cap|trim (?:winner|half|25%)/i;

/**
 * Reconcile the model's stance/conviction with the user's stated bias + any
 * explicit cap-breach. The LLM's thesis/risk/action are left untouched.
 */
export function reconcileWithBias(
  bias: StatedBias,
  notes: string,
  sig: RawAssetSignal,
): RawAssetSignal {
  let stance: Stance = sig.stance;
  let conviction = sig.conviction;

  switch (bias) {
    case "avoid":
      stance = "avoid";
      conviction = Math.min(conviction, 2);
      break;
    case "accumulate":
      if (stance !== "accumulate" && stance !== "bullish") stance = "accumulate";
      conviction = Math.max(conviction, 3);
      break;
    case "bullish":
      if (!["bullish", "accumulate", "reduce"].includes(stance)) stance = "bullish";
      break;
    case "cautious":
      if (stance === "bullish" || stance === "accumulate") stance = "neutral";
      conviction = Math.min(conviction, 3);
      break;
    case "neutral":
      if (stance === "bullish" || stance === "bearish") stance = "neutral";
      break;
    case "unknown":
      break;
  }

  // Cap-breach overrides a long stance — never add to an oversized position
  // (but an explicit "avoid" stays avoid).
  if (stance !== "avoid" && TRIM_SIGNAL.test(notes)) stance = "reduce";

  conviction = Math.min(5, Math.max(1, conviction));
  return { ...sig, stance, conviction };
}
