/**
 * Terminal rendering of a SignalReport — a compact, screen-recordable layout.
 */

import type { SignalReport, AssetSignal } from "../core/signal-report-schema.ts";

const convictionBar = (n: number): string => "█".repeat(n) + "░".repeat(5 - n);

function renderSignal(s: AssetSignal): string {
  const lines: string[] = [];
  lines.push(`  ${s.asset.padEnd(6)} ${s.stance.toUpperCase().padEnd(10)} conviction ${convictionBar(s.conviction)} ${s.conviction}/5`);
  lines.push(`     thesis : ${s.thesis}`);
  lines.push(`     risk   : ${s.risk}`);
  lines.push(`     action : ${s.suggestedAction}`);
  if (s.sources.length > 0) {
    lines.push(`     grounded on ${s.sources.length} retrieved note(s), e.g. "${s.sources[0]}..."`);
  }
  return lines.join("\n");
}

export function renderReport(report: SignalReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("═".repeat(64));
  lines.push("  COLDWIRE — PRIVATE SIGNAL REPORT (100% on-device)");
  lines.push("═".repeat(64));
  lines.push(`  generated : ${report.generatedAt}`);
  lines.push(`  data      : ${report.dataDir}  (${report.assetCount} assets)`);
  lines.push("");
  lines.push("  PORTFOLIO");
  lines.push(`  ${report.portfolio.portfolioSummary}`);
  if (report.portfolio.keyRisks.length > 0) {
    lines.push("  key risks:");
    for (const r of report.portfolio.keyRisks) lines.push(`    - ${r}`);
  }
  lines.push("");
  lines.push("  SIGNALS");
  lines.push("─".repeat(64));
  for (const s of report.signals) {
    lines.push(renderSignal(s));
    lines.push("");
  }
  return lines.join("\n");
}
