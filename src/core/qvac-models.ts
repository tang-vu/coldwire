/**
 * Thin wrapper around @qvac/sdk model lifecycle + constrained completion.
 *
 * EVERY inference call in Coldwire goes through this module, and every call
 * runs on THIS device via the local QVAC runtime. There are no network calls
 * here beyond the SDK's one-time model download (handled inside loadModel).
 */

import { loadModel, unloadModel, completion, close, profiler } from "@qvac/sdk";
import { LLAMA_3_2_1B_INST_Q4_0, GTE_LARGE_FP16 } from "./qvac-model-descriptors.ts";
import { GENERATION_PARAMS, LLM_CTX_SIZE } from "./coldwire-config.ts";
import type { InferenceStat } from "./signal-report-schema.ts";

export interface ModelProgress {
  percentage: number;
  downloaded: number;
  total: number;
}

type ProgressCb = (p: ModelProgress) => void;

/** Load the Llama 3.2 1B instruct model used for reasoning. Returns its modelId. */
export async function loadLLM(onProgress?: ProgressCb): Promise<string> {
  return await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    modelConfig: { ctx_size: LLM_CTX_SIZE },
    onProgress,
  });
}

/** Load the GTE-large embedding model (1024-d) used for RAG. Returns its modelId. */
export async function loadEmbedModel(onProgress?: ProgressCb): Promise<string> {
  return await loadModel({ modelSrc: GTE_LARGE_FP16, onProgress });
}

export async function unload(modelId: string): Promise<void> {
  await unloadModel({ modelId });
}

/** Releases the RPC connection + bare worker. Call once at the very end. */
export async function shutdown(): Promise<void> {
  await close();
}

/** Enable on-device profiling. `verbose` keeps a ring buffer of recent events. */
export function enableProfiler(): void {
  profiler.enable({ mode: "verbose", includeServerBreakdown: true });
}

export function profilerSummary(): string {
  return profiler.isEnabled() ? profiler.exportSummary() : "(profiler disabled)";
}

export function profilerJSON(): unknown {
  return profiler.exportJSON({ includeRecentEvents: true });
}

export interface StructuredResult<T> {
  data: T;
  raw: string;
  stat: InferenceStat;
}

/**
 * Run a JSON-schema-constrained completion on-device and parse the result.
 *
 * We consume `events` (guaranteeing the stream is driven to completion and
 * giving us live content) and read `final` for inference telemetry.
 */
export async function generateStructured<T>(args: {
  llmId: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  label: string;
  parse: (text: string) => T;
  onToken?: (t: string) => void;
}): Promise<StructuredResult<T>> {
  const run = completion({
    modelId: args.llmId,
    history: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    stream: true,
    generationParams: GENERATION_PARAMS,
    responseFormat: {
      type: "json_schema",
      json_schema: { name: args.schemaName, schema: args.schema },
    },
  });

  let content = "";
  for await (const ev of run.events) {
    if (ev.type === "contentDelta") {
      content += ev.text;
      args.onToken?.(ev.text);
    }
  }

  const final = await run.final;
  const text = content || final.contentText || final.raw?.fullText || "";
  const s = final.stats ?? {};
  const stat: InferenceStat = {
    label: args.label,
    backendDevice: s.backendDevice,
    tokensPerSecond: s.tokensPerSecond,
    promptTokens: s.promptTokens,
    generatedTokens: s.generatedTokens,
    timeToFirstTokenMs: s.timeToFirstToken,
  };

  return { data: args.parse(text), raw: text, stat };
}
