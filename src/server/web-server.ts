/**
 * Minimal web UI for Coldwire — zero external dependencies (Node's built-in
 * http only). Serves a single-page UI and streams the on-device pipeline's
 * progress + final report over Server-Sent Events.
 *
 * No inference happens here that isn't @qvac/sdk on-device; this server only
 * orchestrates the same core the CLI uses. It binds to localhost by default.
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { generateSignalReport } from "../core/signal-agent.ts";
import { writeProofArtifacts } from "../core/on-device-proof.ts";
import { shutdown } from "../core/qvac-models.ts";
import { DEFAULT_DATA_DIR } from "../core/coldwire-config.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8787);

/** One pipeline at a time — model + RAG workspace are single-tenant. */
let busy = false;

function sse(res: http.ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleReport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  if (busy) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "A report is already being generated. Try again shortly." }));
    return;
  }
  busy = true;
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const dataDir = url.searchParams.get("data") || DEFAULT_DATA_DIR;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  sse(res, "phase", { phase: `Starting on-device pipeline (${os.hostname()})` });

  try {
    const report = await generateSignalReport({
      dataDir,
      events: {
        onPhase: (phase) => sse(res, "phase", { phase }),
        onAsset: (ticker, index, total) => sse(res, "asset", { ticker, index, total }),
        onModelDownload: (label, p) =>
          sse(res, "download", { label, percentage: Math.floor(p.percentage) }),
      },
    });
    const proofFile = await writeProofArtifacts(report);
    sse(res, "report", { report, proofFile });
  } catch (err) {
    sse(res, "error", { message: (err as Error).message });
  } finally {
    busy = false;
    res.end();
  }
}

async function serveStatic(res: http.ServerResponse): Promise<void> {
  try {
    const html = await readFile(path.join(HERE, "public", "index.html"), "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("index.html not found");
  }
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host}`).pathname;
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, host: os.hostname() }));
  } else if (pathname === "/api/report") {
    void handleReport(req, res);
  } else if (pathname === "/" || pathname === "/index.html") {
    void serveStatic(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Coldwire web UI → http://${HOST}:${PORT}  (100% on-device)\n`);
});

const stop = async () => {
  server.close();
  await shutdown().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
