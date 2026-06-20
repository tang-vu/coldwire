#!/usr/bin/env node
/**
 * Coldwire CLI — runs the full on-device signal pipeline on the sample (or your
 * own) private data and prints a structured report plus on-device proof.
 *
 *   node src/cli/coldwire-cli.ts                 # uses data/sample
 *   node src/cli/coldwire-cli.ts --data data/private
 *   node src/cli/coldwire-cli.ts --json          # raw JSON report to stdout
 */

import { generateSignalReport } from "../core/signal-agent.ts";
import { renderReport } from "./render-signal-report.ts";
import { renderProof, writeProofArtifacts } from "../core/on-device-proof.ts";
import { shutdown, type ModelProgress } from "../core/qvac-models.ts";
import { DEFAULT_DATA_DIR } from "../core/coldwire-config.ts";

interface CliArgs {
  dataDir: string;
  json: boolean;
  proof: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dataDir: DEFAULT_DATA_DIR, json: false, proof: true, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--data") args.dataDir = argv[++i] ?? DEFAULT_DATA_DIR;
    else if (a === "--json") args.json = true;
    else if (a === "--no-proof") args.proof = false;
    else if (a === "--help" || a === "-h") args.help = true;
  }
  return args;
}

const HELP = `Coldwire — 100% on-device private alpha agent (powered by @qvac/sdk)

Usage:
  node src/cli/coldwire-cli.ts [options]

Options:
  --data <dir>   Directory of private .md/.txt docs (default: ${DEFAULT_DATA_DIR})
  --json         Print the raw JSON SignalReport instead of the formatted view
  --no-proof     Skip writing the on-device proof artifact
  -h, --help     Show this help
`;

function downloadReporter() {
  const lastPct = new Map<string, number>();
  return (label: string, p: ModelProgress) => {
    const pct = Math.floor(p.percentage);
    if ((lastPct.get(label) ?? -10) + 5 > pct && pct < 100) return;
    lastPct.set(label, pct);
    const mb = (n: number) => (n / 1e6).toFixed(0);
    process.stderr.write(`  ↓ downloading ${label} ${pct}% (${mb(p.downloaded)}/${mb(p.total)} MB)\n`);
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const t0 = Date.now();
  if (!args.json) process.stderr.write("Coldwire: generating private signal report on-device...\n");

  const report = await generateSignalReport({
    dataDir: args.dataDir,
    events: {
      onPhase: (phase) => !args.json && process.stderr.write(`▸ ${phase}\n`),
      onAsset: (ticker, i, total) =>
        !args.json && process.stderr.write(`  • reasoning ${ticker} (${i}/${total})\n`),
      onModelDownload: downloadReporter(),
    },
  });

  if (args.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(renderReport(report));
    process.stdout.write("\n" + renderProof(report) + "\n");
    process.stderr.write(`\n(done in ${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
  }

  if (args.proof) {
    const file = await writeProofArtifacts(report);
    if (!args.json) process.stderr.write(`proof artifact written: ${file}\n`);
  }
}

main()
  .catch((err) => {
    process.stderr.write(`\nColdwire failed: ${(err as Error).stack ?? err}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown().catch(() => {});
  });
