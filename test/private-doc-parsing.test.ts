import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAssetUniverse, extractAssetNotes } from "../src/core/private-doc-parsing.ts";

const watchlist = {
  name: "watchlist.md",
  content: "## BTC — Bitcoin\n- Bias: constructive.\n\n## DOGE — Dogecoin\n- Bias: avoid / sentiment.\n",
};
const positions = {
  name: "positions.md",
  content: "## Position 1 — SOL (long spot)\n- Size: 220 SOL, OVERSIZED\n\n## Realized\n- closed LINK\n",
};

test("extractAssetUniverse finds watchlist tickers in order", () => {
  const assets = extractAssetUniverse([watchlist]);
  assert.deepEqual(assets.map((a) => a.ticker), ["BTC", "DOGE"]);
  assert.equal(assets[0].name, "Bitcoin");
});

test("extractAssetNotes pulls the asset's own section incl. position blocks", () => {
  const notes = extractAssetNotes([watchlist, positions], { ticker: "SOL", name: "Solana" });
  assert.match(notes, /Position 1 — SOL/);
  assert.match(notes, /OVERSIZED/);
});

test("extractAssetNotes scopes to the requested asset only", () => {
  const notes = extractAssetNotes([watchlist], { ticker: "BTC", name: "Bitcoin" });
  assert.match(notes, /constructive/);
  assert.ok(!/DOGE/.test(notes));
});
