/**
 * P2P delegated inference (Phase 2 — feature-flagged, isolated).
 *
 * Offloads the heavy LLM completion to a trusted peer over Holepunch's
 * encrypted P2P transport (Hyperswarm DHT). No server, no cloud — the peer is
 * your own second device or a trusted node. Embeddings + RAG always stay local,
 * so the private vector context never leaves this machine.
 *
 * CORE-SAFETY INVARIANT: the consumer always loads with `fallbackToLocal: true`,
 * so if the provider is unreachable the SDK transparently runs inference
 * locally. P2P can therefore never break the core pipeline.
 */

import { startQVACProvider, stopQVACProvider } from "@qvac/sdk";

export interface DelegateConfig {
  providerPublicKey: string;
  timeout: number;
  fallbackToLocal: boolean;
}

/** Build a consumer delegate config that always falls back to local inference. */
export function buildDelegate(providerPublicKey: string, timeoutMs = 60_000): DelegateConfig {
  return { providerPublicKey, timeout: timeoutMs, fallbackToLocal: true };
}

/**
 * Start a provider node. With `allowedConsumerKeys`, only those public keys may
 * delegate (allow-list firewall); otherwise any peer may connect.
 * Returns this provider's public key (share it with consumers).
 */
export async function startProvider(allowedConsumerKeys?: string[]): Promise<string> {
  const params =
    allowedConsumerKeys && allowedConsumerKeys.length > 0
      ? { firewall: { mode: "allow" as const, publicKeys: allowedConsumerKeys } }
      : undefined;
  const res = await startQVACProvider(params);
  if (!res.success || !res.publicKey) {
    throw new Error(`Failed to start QVAC provider: ${res.error ?? "unknown error"}`);
  }
  return res.publicKey;
}

export async function stopProvider(): Promise<void> {
  await stopQVACProvider();
}
