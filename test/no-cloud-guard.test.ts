import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/** The no-cloud guard must pass on this repo (no cloud inference endpoints). */
test("verify-no-cloud-endpoints passes", () => {
  const script = path.resolve(import.meta.dirname, "../scripts/verify-no-cloud-endpoints.ts");
  const res = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(res.status, 0, `expected exit 0, got ${res.status}\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /PASS/);
});
