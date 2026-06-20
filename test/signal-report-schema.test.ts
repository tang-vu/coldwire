import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonLoose, normalizeSignal } from "../src/core/signal-report-schema.ts";

test("parseJsonLoose strips code fences and stray prose", () => {
  const o = parseJsonLoose<{ a: number }>("here you go:\n```json\n{ \"a\": 1 }\n```\nthanks");
  assert.equal(o.a, 1);
});

test("normalizeSignal clamps conviction and validates stance", () => {
  const n = normalizeSignal({
    stance: "definitely-up" as never,
    conviction: 9,
    thesis: "t",
    risk: "r",
    suggestedAction: "a",
  });
  assert.equal(n.stance, "neutral");
  assert.equal(n.conviction, 5);
});

test("normalizeSignal floors conviction and fills empty fields", () => {
  const n = normalizeSignal({ stance: "avoid", conviction: 0 });
  assert.equal(n.conviction, 1);
  assert.equal(n.stance, "avoid");
  assert.ok(n.thesis.length > 0);
});
