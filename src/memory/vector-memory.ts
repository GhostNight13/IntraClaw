/**
 * Vector Memory — ChromaDB semantic search layer
 *
 * Provides semantic similarity search over IntraClaw's long-term memory.
 * Gracefully degrades: if ChromaDB isn't running, all operations are no-ops.
 */

import { ChromaClient } from 'chromadb';
import type { Collection, Metadata } from 'chromadb';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';

const CHROMA_HOST = process.env.CHROMA_HOST ?? 'localhost';
const CHROMA_PORT = parseInt(process.env.CHROMA_PORT ?? '8000', 10);
const COLLECTION_NAME = 'intraclaw_memory';

let _client: ChromaClient | null = null;
let _collection: Collection | null = null;
let _available = false;

/**
 * Initialize ChromaDB connection.
 * Non-blocking — if ChromaDB isn't running, vector memory is silently disabled.
 */
export async function initVectorMemory(): Promise<boolean> {
  try {
    _client = new ChromaClient({ host: `http://${CHROMA_HOST}:${CHROMA_PORT}` });

    // Test connection
    await _client.heartbeat();

    _collection = await _client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'IntraClaw long-term semantic memory' },
    });

    _available = true;
    const count = await _collection.count();
    logger.info('VectorMemory', `Connected to ChromaDB (${count} documents in ${COLLECTION_NAME})`);
    return true;
  } catch (err) {
    _available = false;
    logger.warn('VectorMemory', 'ChromaDB not available — vector memory disabled',
      err instanceof Error ? err.message : err);
    return false;
  }
}

export function isVectorMemoryAvailable(): boolean {
  return _available;
}

/**
 * Store a memory document with metadata.
 */
export async function storeMemory(params: {
  content: string;
  category: string;       // 'prospect', 'email', 'learning', 'action', 'conversation'
  source: string;         // 'prospection-agent', 'cold-email', 'telegram', etc.
  metadata?: Record<string, string | number | boolean>;
}): Promise<string | null> {
  if (!_available || !_collection) return null;

  const id = randomUUID();
  try {
    const meta: Record<string, string | number | boolean> = {
      category: params.category,
      source: params.source,
      timestamp: new Date().toISOString(),
      ...params.metadata,
    };

    await _collection.add({
      ids: [id],
      documents: [params.content],
      metadatas: [meta as Metadata],
    });
    logger.info('VectorMemory', `Stored memory [${params.category}]: ${params.content.slice(0, 80)}...`);
    return id;
  } catch (err) {
    logger.error('VectorMemory', 'Failed to store memory', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Search memories by semantic similarity.
 */
export async function searchMemory(query: string, options?: {
  maxResults?: number;
  category?: string;
}): Promise<Array<{
  id: string;
  content: string;
  category: string;
  source: string;
  timestamp: string;
  distance: number;
}>> {
  if (!_available || !_collection) return [];

  const nResults = options?.maxResults ?? 5;
  const where = options?.category
    ? { category: options.category } as Record<string, string>
    : undefined;

  try {
    const results = await _collection.query({
      queryTexts: [query],
      nResults,
      where,
    });

    if (!results.ids[0]) return [];

    return results.ids[0].map((id, i) => ({
      id,
      content: results.documents[0]?.[i] ?? '',
      category: (results.metadatas[0]?.[i] as Record<string, string>)?.category ?? 'unknown',
      source: (results.metadatas[0]?.[i] as Record<string, string>)?.source ?? 'unknown',
      timestamp: (results.metadatas[0]?.[i] as Record<string, string>)?.timestamp ?? '',
      distance: results.distances[0]?.[i] ?? 0,
    }));
  } catch (err) {
    logger.error('VectorMemory', 'Search failed', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Get recent memories by category.
 */
export async function getRecentMemories(category: string, limit = 10): Promise<Array<{
  content: string;
  timestamp: string;
}>> {
  if (!_available || !_collection) return [];

  try {
    const results = await _collection.get({
      where: { category } as Record<string, string>,
      limit,
    });

    return results.documents.map((doc, i) => ({
      content: doc ?? '',
      timestamp: (results.metadatas[i] as Record<string, string>)?.timestamp ?? '',
    }));
  } catch (err) {
    logger.error('VectorMemory', 'getRecentMemories failed', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Get stats about the vector memory.
 */
export async function getVectorMemoryStats(): Promise<{
  available: boolean;
  totalDocuments: number;
}> {
  if (!_available || !_collection) {
    return { available: false, totalDocuments: 0 };
  }

  try {
    const count = await _collection.count();
    return { available: true, totalDocuments: count };
  } catch {
    return { available: false, totalDocuments: 0 };
  }
}
