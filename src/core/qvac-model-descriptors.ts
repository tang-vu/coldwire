/**
 * Model descriptor constants from @qvac/sdk.
 *
 * Constants like LLAMA_3_2_1B_INST_Q4_0 and GTE_LARGE_FP16 are real runtime
 * exports of the SDK — verified by running them (see scripts/smoke-test.ts) —
 * but @qvac/sdk v0.13.5 does not surface them through its published .d.ts
 * (an `export *` propagation gap in the generated model-registry types).
 *
 * We therefore read them off the module object at runtime and fail loudly if a
 * name is missing. Typed loosely on purpose: loadModel accepts them as opaque
 * model descriptors at runtime, and the SDK's internal ModelDescriptor type is
 * not publicly exported. This shim is the single place that workaround lives.
 */

import * as qvac from "@qvac/sdk";

const registry = qvac as unknown as Record<string, unknown>;

function descriptor(name: string): any {
  const value = registry[name];
  if (value == null) {
    throw new Error(
      `@qvac/sdk model descriptor '${name}' not found at runtime (SDK version mismatch?).`,
    );
  }
  return value;
}

export const LLAMA_3_2_1B_INST_Q4_0 = descriptor("LLAMA_3_2_1B_INST_Q4_0");
export const GTE_LARGE_FP16 = descriptor("GTE_LARGE_FP16");
