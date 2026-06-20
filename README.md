# Coldwire — a 100% on-device private alpha agent

> Your watchlist, open positions and strategy never leave your machine.
> Coldwire reads your **private** trader notes and produces a structured signal
> report using **local inference + RAG** via [`@qvac/sdk`](https://docs.qvac.tether.io).
> **Zero cloud. $0 inference. Works offline.**

Built for the Tether **QVAC "Unleash Edge AI"** hackathon. Apache-2.0.

**Live showcase (static snapshot of a real on-device run):**
[coldwire-edge-ai.vercel.app](https://coldwire-edge-ai.vercel.app)
— this page only *displays* a report generated 100% on-device; **no inference runs on it**.

---

## Why edge?

A crypto trader's edge *is* their private data — positions, sizing, strategy,
the rules they actually trade by. Sending that to a cloud LLM leaks the one thing
that matters. Coldwire keeps all of it on the device:

- **Private** — positions/strategy are embedded and reasoned over locally; nothing is uploaded.
- **Offline** — after a one-time model download, it runs with the network off (airplane mode).
- **$0 / no lock-in** — no API bills, no keys, no vendor. You own the whole stack.

## Hard guarantees (verifiable)

- **All AI inference runs through `@qvac/sdk` on this device.** Embeddings (RAG) and
  text generation both execute on the local QVAC runtime.
- **No cloud inference, no telemetry, no remote calls at runtime.** The *only* network
  use is the SDK's one-time model download. Enforced by a CI guard:
  `npm run check:no-cloud`.
- Open source (Apache-2.0), reproducible from a clean clone, Node ≥ 22.17, TypeScript, ESM.

---

## What it does (pipeline)

```
 data/sample/*.md  ──►  GTE-large embeddings  ──►  local RAG (HyperDB workspace)
 (watchlist,             (@qvac/sdk, on-device)        │
  positions,                                           ▼
  strategy)                              per-asset retrieve  +  exact note section
                                                       │
                                                       ▼
                              Llama 3.2 1B (JSON-schema-constrained completion)
                                                       │
                                          deterministic bias-grounding
                                                       ▼
                          structured Signal Report  +  on-device proof
                       (per asset: stance · conviction · thesis · risk · action)
```

Every embedding and every completion is a local `@qvac/sdk` call. RAG retrieval
grounds each signal in your real notes; a small deterministic layer guarantees the
agent never contradicts your own stated `Bias:` line.

---

## Reproduce from zero

Requirements: **Node ≥ 22.17**, npm ≥ 10.9. (Tested on Node v24.14.1.)

```bash
git clone <this-repo> && cd coldwire
npm install

# 1) Smoke test — confirms the toolchain + on-device model load + streaming
npm run smoke

# 2) Run the agent on the synthetic sample data (downloads models on first run)
npm run coldwire

# 3) Or use the web UI (zero external deps) — open http://127.0.0.1:8787
npm run serve
```

First run downloads two models (~1.4 GB total) into `~/.qvac/models` and
checksum-validates them; subsequent runs are fully offline and take ~60s.

Useful flags:

```bash
npm run coldwire -- --data data/sample   # point at your own private docs dir
npm run coldwire -- --json               # raw JSON SignalReport
npm run check:no-cloud                    # prove there are no cloud endpoints
npm run typecheck                         # tsc --noEmit
```

---

## Models (how they're fetched)

| Role | Constant (`@qvac/sdk`) | File | Size |
|---|---|---|---|
| Reasoning LLM | `LLAMA_3_2_1B_INST_Q4_0` | `Llama-3.2-1B-Instruct-Q4_0.gguf` | ~773 MB |
| Embeddings (RAG) | `GTE_LARGE_FP16` (1024-d) | GTE-large fp16 GGUF | ~670 MB |

Models are downloaded by the SDK from the QVAC model registry to `~/.qvac/models`
on first use and **sha256 checksum-validated** (you'll see `Checksum validated` in
the logs). No model weights are committed to this repo.

---

## On-device proof (how to verify it's local)

Coldwire makes "it ran locally" auditable:

1. **Per-call telemetry** — each run prints `device=gpu|cpu` and tokens/sec per
   inference call (from the SDK profiler). Cloud calls can't report a local backend device.
2. **Profiler export** — a full QVAC profiler JSON is written to
   `proof/coldwire-proof-<timestamp>.json` every run.
3. **Airplane-mode test** — after the first model download, **disable your network**
   and run `npm run coldwire` again. It still generates signals. (This is the
   strongest proof; see `SUBMISSION_CHECKLIST.md`.)

Example proof block (real output on the test machine):

```
ON-DEVICE PROOF
host:        DESKTOP-1A6OPC9
llm:         LLAMA_3_2_1B_INST_Q4_0
embeddings:  GTE_LARGE_FP16
  • signal:SOL    device=gpu  40.5 tok/s  117 gen
  • portfolio     device=gpu  48.4 tok/s  92 gen
```

---

## Sample-data walkthrough

`data/sample/` ships **synthetic** (fake) trader data so the repo runs with no
secrets:

- `watchlist.md` — assets with a `## TICKER — Name` heading + a `Bias:` line.
- `positions.md` — open positions, sizes, weights, stops.
- `strategy.md` — the trader's rules + conviction framework.

On this data Coldwire correctly surfaces real rule breaches, e.g.
*"SOL is 36% of NAV, above my 25% single-alt cap"* and *"total alt exposure 53.7% > 50% cap"*,
and emits stances consistent with each asset's stated bias (e.g. DOGE → `avoid`).

To use your own data: drop `.md`/`.txt` files in a directory (keep the
`## TICKER — Name` + `Bias:` convention in your watchlist) and run
`npm run coldwire -- --data path/to/your/docs`. Put real notes under
`data/private/` — it's git-ignored.

---

## Optional: P2P delegated inference (feature-flagged)

A node can offload the heavy LLM completion to a **trusted peer** (your own second
device) over Holepunch's encrypted P2P transport — **no server, no cloud**.
Embeddings + RAG always stay local, so your private vector context never leaves
the machine.

```bash
# Device B (provider) — prints a public key:
npm run provider

# Device A (consumer) — offload the LLM to that peer:
npm run coldwire -- --delegate <provider-public-key>
```

**Core-safety:** delegation always uses `fallbackToLocal: true`, so if the peer is
unreachable Coldwire transparently runs the LLM locally. P2P can never break the
core pipeline. It is entirely off unless you pass `--delegate`.

---

## Project layout

```
src/core/    parsing · RAG · models · prompts · bias-grounding · agent · proof
src/cli/     coldwire-cli.ts (+ formatted/JSON rendering)
src/server/  zero-dep HTTP web UI with SSE live progress
src/p2p/     delegated-inference helpers + provider node (Phase 2)
scripts/     smoke-test.ts · verify-no-cloud-endpoints.ts
data/sample/ synthetic watchlist / positions / strategy
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
