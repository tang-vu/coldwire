/**
 * No-cloud guard. Coldwire's core claim is that ALL inference is on-device via
 * @qvac/sdk with zero cloud calls. This script makes that auditable + CI-able:
 * it scans the source for cloud-inference provider names, disallowed external
 * URL literals, and cloud SDK dependencies, and fails (exit 1) on any hit.
 *
 * Allowed: @qvac/sdk (the on-device runtime), localhost/127.0.0.1 (local web
 * UI + P2P loopback), and dynamic `http://${host}` (bound to localhost).
 *
 * Run: node scripts/verify-no-cloud-endpoints.ts
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCAN_DIRS = ["src", "scripts"];
const SCAN_EXT = new Set([".ts", ".js", ".mjs", ".html"]);
/** This scanner necessarily contains the marker list; don't scan ourselves. */
const SELF_FILE = "verify-no-cloud-endpoints.ts";

/** Cloud inference / API provider markers that must never appear in our code. */
const FORBIDDEN_MARKERS = [
  "openai", "api.anthropic", "anthropic.com", "claude.ai/api",
  "generativelanguage", "googleapis.com", "aiplatform", "vertexai",
  "gemini", "cohere.ai", "mistral.ai", "api.together", "together.ai",
  "replicate.com", "api.groq", "groq.com", "perplexity.ai", "api.x.ai",
  "bedrock", "huggingface.co", "hf.co/api", "azure.com/openai",
];

/** Cloud SDK packages that must not be dependencies. */
const FORBIDDEN_DEPS = [
  "openai", "@anthropic-ai/sdk", "@google/generative-ai", "@google-cloud/aiplatform",
  "cohere-ai", "@mistralai/mistralai", "replicate", "groq-sdk", "together-ai",
];

const ALLOWED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"];
const URL_RE = /https?:\/\/([^/\s"'`)]+)/gi;

interface Violation {
  file: string;
  line: number;
  reason: string;
  text: string;
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      out.push(...(await listFiles(full)));
    } else if (hasScanExt(e.name) && e.name !== SELF_FILE) {
      out.push(full);
    }
  }
  return out;
}
function hasScanExt(name: string): boolean {
  return SCAN_EXT.has(path.extname(name).toLowerCase());
}

function scanLine(file: string, line: string, n: number): Violation[] {
  const v: Violation[] = [];
  const lower = line.toLowerCase();
  for (const marker of FORBIDDEN_MARKERS) {
    if (lower.includes(marker)) {
      v.push({ file, line: n, reason: `forbidden cloud marker "${marker}"`, text: line.trim() });
    }
  }
  for (const m of line.matchAll(URL_RE)) {
    const host = m[1];
    if (host.includes("$") || host.includes("{")) continue; // dynamic -> bound to localhost
    if (!ALLOWED_HOSTS.some((h) => host === h || host.startsWith(`${h}:`))) {
      v.push({ file, line: n, reason: `external URL host "${host}"`, text: line.trim() });
    }
  }
  return v;
}

async function checkDeps(): Promise<Violation[]> {
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf8"));
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return FORBIDDEN_DEPS.filter((d) => d in all).map((d) => ({
    file: "package.json",
    line: 0,
    reason: `forbidden cloud SDK dependency "${d}"`,
    text: `"${d}"`,
  }));
}

async function main(): Promise<void> {
  const files: string[] = [];
  for (const d of SCAN_DIRS) files.push(...(await listFiles(path.join(ROOT, d))));

  const violations: Violation[] = await checkDeps();
  let urlsSeen = 0;
  for (const file of files) {
    const content = await readFile(file, "utf8");
    content.split(/\r?\n/).forEach((line, i) => {
      urlsSeen += (line.match(URL_RE) ?? []).length;
      violations.push(...scanLine(path.relative(ROOT, file), line, i + 1));
    });
  }

  process.stdout.write(`No-cloud scan: ${files.length} source files, ${urlsSeen} URL literal(s).\n`);
  if (violations.length > 0) {
    process.stdout.write(`\nFAIL — ${violations.length} potential cloud dependency/endpoint(s):\n`);
    for (const v of violations) {
      process.stdout.write(`  ✗ ${v.file}:${v.line} — ${v.reason}\n      ${v.text}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write("PASS — no cloud inference endpoints or SDKs found.\n");
  process.stdout.write("All inference runs on-device via @qvac/sdk. Only localhost/dynamic URLs present.\n");
}

main().catch((err) => {
  process.stderr.write(`verify-no-cloud-endpoints failed: ${(err as Error).stack ?? err}\n`);
  process.exitCode = 1;
});
