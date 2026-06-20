/**
 * Smoke test — confirms the QVAC toolchain + model load + streaming completion
 * work end-to-end on THIS device before we build anything on top.
 *
 * Mirrors the official quickstart (streaming `completion` with Llama 3.2 1B).
 * Run: node scripts/smoke-test.ts
 */

const { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } = await import("@qvac/sdk");

console.error("[smoke] loading Llama 3.2 1B (downloads on first run, then cached)...");

const modelId = await loadModel({
  modelSrc: LLAMA_3_2_1B_INST_Q4_0,
  onProgress: (p: { percentage: number; downloaded: number; total: number }) => {
    const mb = (n: number) => (n / 1e6).toFixed(1);
    const line = `  downloading ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)`;
    process.stderr.write(process.stderr.isTTY ? `\r${line}` : `${line}\n`);
  },
});

console.error(`\n[smoke] model loaded. id=${modelId}`);
console.error("[smoke] streaming a one-sentence completion:\n");

const history = [{ role: "user", content: "Explain quantum computing in one sentence." }];
const result = completion({ modelId, history, stream: true });

let tokenCount = 0;
for await (const token of result.tokenStream) {
  process.stdout.write(token);
  tokenCount++;
}

console.error(`\n\n[smoke] done. streamed ${tokenCount} token chunks.`);

await unloadModel({ modelId });
console.error("[smoke] model unloaded. OK.");
