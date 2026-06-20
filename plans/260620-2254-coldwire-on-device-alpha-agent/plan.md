# Coldwire — On-Device Private Alpha Agent (QVAC Hackathon)

**Goal:** 100%-on-device private "alpha agent" for crypto traders. Ingests private trader
data (watchlist/positions/strategy), produces a structured signal report via local
inference + RAG. All AI runs through `@qvac/sdk` on-device. Zero cloud inference.

**Hackathon:** Tether QVAC "Unleash Edge AI" (DoraHacks). Deadline 2026-06-22 ~06:59 UTC.

## Hard Constraints (judges verify)
- ALL inference via `@qvac/sdk`, on this device. Zero cloud LLM/API/telemetry/remote calls.
  Only allowed network = SDK's one-time model download.
- Apache-2.0, open source, reproducible on clean machine, trivially verifiable as on-device.
- Node >=22.17, TypeScript, ESM.

## Architecture Decisions (locked, grounded in real SDK v0.13.5 .d.ts)
- **Interface:** CLI-first + tiny built-in Node `http` web UI (zero external deps).
  Electron rejected: ~200 LOC boilerplate + asar/native-prebuild gotchas → slower, less reproducible.
- **Structured output:** `completion({ responseFormat: { type: "json_schema", json_schema } })`.
  llama.cpp enforces the schema via GBNF on-device → robust JSON, no fragile text parsing.
  Encode `required` + `additionalProperties:false` explicitly (SDK `strict` is non-tightening).
- **RAG:** `ragIngest` (chunk on) → `ragSearch(topK)`. Embeddings = `GTE_LARGE_FP16` (1024-d).
  Skip/guard `ragReindex` (needs >=16 docs for HyperDB).
- **Models:** LLM = `LLAMA_3_2_1B_INST_Q4_0` (fast BYOH demo). Embed = `GTE_LARGE_FP16`.
- **On-device proof:** `profiler.enable()` + `exportSummary/exportTable/exportJSON`; logging stream.
- **P2P (Phase 2):** delegated inference. `startQVACProvider({firewall})` + `loadModel({delegate:{providerPublicKey, fallbackToLocal:true}})`. `fallbackToLocal` gives free core-isolation.

## File Layout
```
src/
  core/
    qvac-models.ts            # load/unload LLM + embed model, profiler wiring
    rag-private-context.ts    # ingest sample/private docs, retrieve top-K
    signal-report-schema.ts   # JSON schema + TS types for the structured report
    signal-agent.ts           # orchestrate: retrieve -> prompt -> constrained completion -> parse
    on-device-proof.ts        # profiler/logging capture + writes proof/ artifacts
  cli/
    coldwire-cli.ts           # end-to-end pipeline, prints report + proof
  server/
    web-server.ts             # built-in http server, /api/signals, serves UI
    public/index.html         # minimal single-page UI
  p2p/                        # Phase 2 only, feature-flagged
data/sample/                  # synthetic watchlist/positions/strategy (done)
scripts/
  smoke-test.ts               # done
  verify-no-cloud-endpoints.ts # Phase 3: grep guard for external endpoints
```

## Phases & Status
- [x] **Step 0 — Ground in real SDK**: docs read, `npm i @qvac/sdk` (v0.13.5), .d.ts mined, smoke test written.
- [~] **Step 0 — Smoke test RUN**: downloading model, awaiting output.
- [ ] **Phase 1 — Core**: models module, RAG, schema, agent, proof, CLI, web UI. Run e2e on sample data.
- [ ] **CHECKPOINT 1** — STOP, show working core, await approval.
- [ ] **Phase 2 — P2P** (delegated inference, feature-flagged, isolated).
- [ ] **Phase 3 — Verification + reproducibility** (no-cloud test/CI grep, README, hygiene).
- [ ] **Final — SUBMISSION_CHECKLIST.md** (human-only tasks).

## Open Questions
- Exact deadline timezone (user says ~14:00 Vietnam 22 Jun; site shows 06:59 — likely UTC). For checklist.
- BTC/laptop hardware for real-device proof — human step.
