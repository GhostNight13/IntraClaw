// src/evolution/embeddings.ts
// Embedding computation with graceful fallback chain:
//   1. Ollama (/api/embeddings, nomic-embed-text / mxbai-embed-large)
//   2. OpenAI text-embedding-3-small (if OPENAI_API_KEY set)
//   3. Deterministic hashing TF-IDF-like fallback (offline-safe, no network)
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_EMBED_MODELS = ['nomic-embed-text', 'mxbai-embed-large'] as const;
const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const OPENAI_EMBED_DIM = 1536;
const HASH_EMBED_DIM = 384;
const EMBED_TIMEOUT_MS = 15_000;

// ─── Availability cache (probe once per process) ──────────────────────────────

let _ollamaAvailable: boolean | null = null;
let _ollamaWorkingModel: string | null = null;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeOllama(): Promise<string | null> {
  if (_ollamaAvailable === false) return null;
  if (_ollamaWorkingModel) return _ollamaWorkingModel;
  try {
    const res = await fetchWithTimeout(`${OLLAMA_BASE_URL}/api/tags`, {}, 3000);
    if (!res.ok) {
      _ollamaAvailable = false;
      return null;
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const installed = new Set((data.models ?? []).map(m => m.name.split(':')[0]));
    for (const model of OLLAMA_EMBED_MODELS) {
      if (installed.has(model)) {
        _ollamaWorkingModel = model;
        _ollamaAvailable = true;
        logger.info('Embeddings', `Ollama embedding model available: ${model}`);
        return model;
      }
    }
    // No embedding model installed — try the first one anyway, Ollama may auto-pull.
    _ollamaWorkingModel = OLLAMA_EMBED_MODELS[0];
    _ollamaAvailable = true;
    return _ollamaWorkingModel;
  } catch {
    _ollamaAvailable = false;
    return null;
  }
}

// ─── Provider: Ollama ─────────────────────────────────────────────────────────

async function embedWithOllama(text: string): Promise<number[] | null> {
  const model = await probeOllama();
  if (!model) return null;
  try {
    const res = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/api/embeddings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      },
      EMBED_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) return null;
    return data.embedding;
  } catch (err) {
    logger.warn('Embeddings', 'Ollama embed failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Provider: OpenAI ─────────────────────────────────────────────────────────

async function embedWithOpenAI(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: text }),
      },
      EMBED_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
    const vec = data.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== OPENAI_EMBED_DIM) return null;
    return vec;
  } catch (err) {
    logger.warn('Embeddings', 'OpenAI embed failed', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Fallback: deterministic hashed TF-IDF-like vector ────────────────────────

/**
 * Tokenize roughly: lowercase, split on non-word, drop stopwords/short tokens.
 */
function tokenize(text: string): string[] {
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'as', 'it', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'not',
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais',
    'est', 'sont', 'dans', 'sur', 'pour', 'avec', 'par', 'ce', 'cette', 'ces',
  ]);
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(tok => tok.length > 2 && !STOPWORDS.has(tok));
}

/**
 * Hash token to a stable bucket index in [0, dim).
 */
function hashToken(token: string, dim: number): number {
  const h = crypto.createHash('sha1').update(token).digest();
  // Use first 4 bytes as uint32
  const n = h.readUInt32BE(0);
  return n % dim;
}

/**
 * Produce a length-normalized sparse-hashed vector. Cheap, deterministic, offline.
 * Not as good as learned embeddings but keeps cosine similarity useful for retrieval.
 */
function embedWithHash(text: string, dim = HASH_EMBED_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  // Term-frequency + bigram features for a little context.
  const features: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    features.push(`${tokens[i]}_${tokens[i + 1]}`);
  }

  for (const feat of features) {
    const idx = hashToken(feat, dim);
    // Sign-hashing trick: spread weight over +/- to reduce collisions.
    const sign = (hashToken(`sign:${feat}`, 2) === 0) ? 1 : -1;
    vec[idx] += sign;
  }

  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
  return vec;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute an embedding for `text` using the best available provider.
 * Order: Ollama → OpenAI → deterministic hash fallback.
 * Guaranteed to return a non-empty numeric vector.
 */
export async function embed(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (trimmed.length === 0) return embedWithHash('empty');

  const viaOllama = await embedWithOllama(trimmed);
  if (viaOllama) return viaOllama;

  const viaOpenAI = await embedWithOpenAI(trimmed);
  if (viaOpenAI) return viaOpenAI;

  return embedWithHash(trimmed);
}

/**
 * Cosine similarity in [-1, 1]. Returns 0 when either vector is zero-length.
 * Vectors of different dimensions return 0 (mixed-provider safety).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
