/**
 * Pure parsing of the trader's private markdown docs — no SDK, no I/O side
 * effects beyond reading files. Separated from the RAG vector layer so each
 * concern stays small and testable.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface PrivateDoc {
  name: string;
  content: string;
}

export interface Asset {
  ticker: string;
  name: string;
}

const DOC_EXTENSIONS = new Set([".md", ".txt", ".markdown"]);
const HEADING = /^#{1,3}\s+/;

/** Read every .md/.txt doc in `dir` (non-recursive) as a private document. */
export async function readPrivateDocs(dir: string): Promise<PrivateDoc[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const docs: PrivateDoc[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!DOC_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    const content = await readFile(path.join(dir, entry.name), "utf8");
    docs.push({ name: entry.name, content });
  }
  if (docs.length === 0) throw new Error(`No .md/.txt private docs found in: ${dir}`);
  return docs;
}

/**
 * Asset universe from `## TICKER — Name` headings (the watchlist format).
 * Tickers are 2–6 upper-case alphanumerics.
 */
export function extractAssetUniverse(docs: PrivateDoc[], max = 12): Asset[] {
  const re = /^#{1,3}\s+([A-Z][A-Z0-9]{1,5})\s*[—\-–]\s*(.+?)\s*$/gm;
  const seen = new Map<string, Asset>();
  for (const doc of docs) {
    for (const m of doc.content.matchAll(re)) {
      if (!seen.has(m[1])) seen.set(m[1], { ticker: m[1], name: m[2].trim() });
    }
  }
  return [...seen.values()].slice(0, max);
}

/**
 * Exact primary notes for an asset: every heading section whose heading line
 * mentions the ticker (its watchlist block + any position block like
 * "## Position 1 — SOL ..."). This guarantees the model sees the user's real
 * stated view, rather than relying on embedding similarity alone.
 */
export function extractAssetNotes(docs: PrivateDoc[], asset: Asset, limit = 1600): string {
  const tickerRe = new RegExp(`\\b${asset.ticker}\\b`);
  const blocks: string[] = [];
  for (const doc of docs) {
    const lines = doc.content.split(/\r?\n/);
    let buf: string[] = [];
    let capturing = false;
    const flush = () => {
      if (capturing && buf.length) blocks.push(buf.join("\n").trim());
      buf = [];
    };
    for (const line of lines) {
      if (HEADING.test(line)) {
        flush();
        capturing = tickerRe.test(line);
        if (capturing) buf.push(line);
      } else if (capturing) {
        buf.push(line);
      }
    }
    flush();
  }
  return blocks.join("\n\n").slice(0, limit);
}

/** Return the content of the first doc whose filename matches `hint` (case-insensitive). */
export function getDocByHint(docs: PrivateDoc[], hint: string): string {
  const re = new RegExp(hint, "i");
  return docs.find((d) => re.test(d.name))?.content ?? "";
}
