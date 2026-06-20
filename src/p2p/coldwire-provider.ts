#!/usr/bin/env node
/**
 * Coldwire P2P inference provider (Phase 2).
 *
 * Runs a QVAC provider node on this device and prints its public key. A peer
 * running the Coldwire CLI with `--delegate <publicKey>` will then offload its
 * LLM completions to this node over Holepunch's encrypted P2P transport —
 * no server, no cloud in between.
 *
 *   node src/p2p/coldwire-provider.ts
 *   # optional: restrict who may connect (comma-separated consumer public keys)
 *   COLDWIRE_ALLOW=<key1>,<key2> node src/p2p/coldwire-provider.ts
 *   # optional: deterministic identity (64-hex seed)
 *   QVAC_HYPERSWARM_SEED=<64-hex> node src/p2p/coldwire-provider.ts
 */

import { startProvider, stopProvider } from "./delegated-inference.ts";
import { shutdown } from "../core/qvac-models.ts";

const allow = process.env.COLDWIRE_ALLOW?.split(",").map((s) => s.trim()).filter(Boolean);

async function main(): Promise<void> {
  process.stderr.write("Starting Coldwire P2P inference provider...\n");
  const publicKey = await startProvider(allow);

  process.stdout.write("\nColdwire provider is LIVE (no server, P2P only).\n");
  process.stdout.write("Public key (share with the consumer device):\n\n");
  process.stdout.write(`  ${publicKey}\n\n`);
  process.stdout.write("On the other device run:\n");
  process.stdout.write(`  npm run coldwire -- --delegate ${publicKey}\n\n`);
  if (allow?.length) process.stderr.write(`firewall: allow-list of ${allow.length} key(s)\n`);
  process.stderr.write("Press Ctrl+C to stop.\n");

  // Keep the process alive while the DHT server serves delegated requests.
  await new Promise<void>(() => {});
}

const stop = async () => {
  process.stderr.write("\nStopping provider...\n");
  await stopProvider().catch(() => {});
  await shutdown().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

main().catch(async (err) => {
  process.stderr.write(`Provider failed: ${(err as Error).stack ?? err}\n`);
  await shutdown().catch(() => {});
  process.exitCode = 1;
});
