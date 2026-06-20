import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatedBias, reconcileWithBias } from "../src/core/bias-grounding.ts";
import type { RawAssetSignal } from "../src/core/signal-report-schema.ts";

const base: RawAssetSignal = {
  stance: "neutral",
  conviction: 3,
  thesis: "t",
  risk: "r",
  suggestedAction: "a",
};

test("parseStatedBias maps explicit Bias: lines", () => {
  assert.equal(parseStatedBias("- Bias: avoid / pure sentiment play."), "avoid");
  assert.equal(parseStatedBias("- Bias: accumulate on weakness."), "accumulate");
  assert.equal(parseStatedBias("- Bias: neutral-to-bullish but laggard."), "neutral");
  assert.equal(parseStatedBias("- Bias: constructive."), "bullish");
  assert.equal(parseStatedBias("- Bias: high-beta long, my biggest conviction alt."), "bullish");
  assert.equal(parseStatedBias("- Bias: cautious. weak token value capture."), "cautious");
});

test("avoid bias forces avoid stance and low conviction", () => {
  const r = reconcileWithBias("avoid", "Bias: avoid", { ...base, stance: "accumulate", conviction: 4 });
  assert.equal(r.stance, "avoid");
  assert.ok(r.conviction <= 2);
});

test("accumulate bias floors conviction to >= 3", () => {
  const r = reconcileWithBias("accumulate", "Bias: accumulate on weakness", { ...base, stance: "bearish", conviction: 1 });
  assert.equal(r.stance, "accumulate");
  assert.ok(r.conviction >= 3);
});

test("cap-breach in notes forces reduce even for a bullish bias", () => {
  const notes = "Bias: high-beta long\n- Weight: 36% of NAV — OVERSIZED vs my 25% single-alt cap";
  const r = reconcileWithBias("bullish", notes, { ...base, stance: "bullish", conviction: 4 });
  assert.equal(r.stance, "reduce");
});

test("cautious bias downgrades bullish to neutral and caps conviction", () => {
  const r = reconcileWithBias("cautious", "Bias: cautious", { ...base, stance: "bullish", conviction: 5 });
  assert.equal(r.stance, "neutral");
  assert.ok(r.conviction <= 3);
});

test("bullish bias does not contradict an explicit avoid trim — avoid stays avoid", () => {
  const r = reconcileWithBias("avoid", "Bias: avoid / sentiment", { ...base, stance: "bullish", conviction: 5 });
  assert.equal(r.stance, "avoid");
});
