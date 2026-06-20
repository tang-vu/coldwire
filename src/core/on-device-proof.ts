/**
 * On-device proof. Coldwire's whole value rests on inference being local, so we
 * make that auditable: persist the QVAC profiler export + per-call telemetry
 * (which backend device ran each call, tokens/sec), and render a proof block
 * a viewer can read at a glance.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { profilerJSON } from "./qvac-models.ts";
import type { SignalReport } from "./signal-report-schema.ts";

const PROOF_NOTE =
  "All embeddings and completions ran locally on this device via @qvac/sdk. " +
  "No cloud inference. The only network use is the SDK's one-time model download.";

/** Persist a machine-readable proof bundle (report meta + full profiler JSON). */
export async function writeProofArtifacts(report: SignalReport, dir = "proof"): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = report.generatedAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `coldwire-proof-${stamp}.json`);
  const payload = {
    note: PROOF_NOTE,
    onDevice: true,
    host: report.proof.host,
    generatedAt: report.generatedAt,
    llmModel: report.llmModel,
    embedModel: report.embedModel,
    delegatedTo: report.proof.delegatedTo ?? null,
    inferenceStats: report.proof.stats,
    profiler: profilerJSON(),
  };
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

/** Human-readable proof block for the terminal. */
export function renderProof(report: SignalReport): string {
  const lines: string[] = [];
  lines.push("ON-DEVICE PROOF");
  lines.push("─".repeat(64));
  lines.push(`host:        ${report.proof.host}`);
  lines.push(`llm:         ${report.llmModel}`);
  lines.push(`embeddings:  ${report.embedModel}`);
  if (report.proof.delegatedTo) {
    lines.push(`delegated:   LLM offloaded to peer ${report.proof.delegatedTo} over encrypted P2P (no server). Embeddings + RAG stayed local.`);
  }
  lines.push(`note:        ${PROOF_NOTE}`);
  lines.push("");
  lines.push("per-call telemetry (proves which local backend ran each call):");
  for (const s of report.proof.stats) {
    const dev = s.backendDevice ?? "?";
    const tps = s.tokensPerSecond != null ? `${s.tokensPerSecond.toFixed(1)} tok/s` : "n/a";
    const gen = s.generatedTokens != null ? `${s.generatedTokens} gen` : "";
    lines.push(`  • ${s.label.padEnd(20)} device=${dev.padEnd(4)} ${tps.padEnd(12)} ${gen}`);
  }
  lines.push("");
  lines.push("profiler summary:");
  lines.push(report.proof.profilerSummary.split("\n").map((l) => `  ${l}`).join("\n"));
  return lines.join("\n");
}
