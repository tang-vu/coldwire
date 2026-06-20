/**
 * Central configuration for Coldwire. Keeps model choices, RAG settings and
 * generation params in one place so the CLI, server and P2P layers stay aligned.
 */

/** Low-temperature, seeded params for grounded, repeatable signal generation. */
export const GENERATION_PARAMS = {
  temp: 0.2,
  top_p: 0.9,
  seed: 7,
  predict: 700,
  repeat_penalty: 1.1,
} as const;

/** Context window for the LLM. Sample private context is small; 4096 is ample. */
export const LLM_CTX_SIZE = 4096;

/** RAG retrieval depth. */
export const RAG_TOP_K_ASSET = 4;
export const RAG_TOP_K_RULES = 4;

/** RAG chunking — small chunks suit short note-style trader docs. */
export const RAG_CHUNK_OPTS = {
  chunkSize: 320,
  chunkOverlap: 48,
  chunkStrategy: "paragraph" as const,
};

/** Workspace name for the private-context vector store. */
export const RAG_WORKSPACE = "coldwire-private";

/** Default directory of private docs (synthetic sample; override with --data). */
export const DEFAULT_DATA_DIR = "data/sample";
