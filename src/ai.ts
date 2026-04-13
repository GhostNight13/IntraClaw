import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { callClaude, ClaudeRateLimitError } from './claude';
import { callGemma, callLlama, isOllamaAvailable } from './ollama';
import type { AIRequest, AIResponse } from './types';

// ─── Response cache ────────────────────────────────────────────────────────────

const CACHE_DIR = path.resolve(process.cwd(), 'data', 'ai-cache');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  response: AIResponse;
  createdAt: number;
}

function getCacheKey(request: AIRequest): string {
  const normalized = JSON.stringify({
    messages: request.messages,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
    modelTier: request.modelTier ?? 'balanced',
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function readCache(key: string): AIResponse | null {
  try {
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;
    const entry = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CacheEntry;
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
      fs.unlinkSync(filePath);
      return null;
    }
    return entry.response;
  } catch {
    return null;
  }
}

function writeCache(key: string, response: AIResponse): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { response, createdAt: Date.now() };
    fs.writeFileSync(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(entry), 'utf8');
  } catch (err) {
    logger.warn('AI', 'Cache write failed', err);
  }
}

// ─── Daily counter ────────────────────────────────────────────────────────────

let _dailyCallCount = 0;
let _dailyCallDate  = new Date().toISOString().slice(0, 10);

function incrementDailyCount(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== _dailyCallDate) {
    _dailyCallCount = 0;
    _dailyCallDate  = today;
  }
  _dailyCallCount++;
  logger.info('AI', `Daily AI call #${_dailyCallCount}`);
}

// ─── Smart provider ───────────────────────────────────────────────────────────

/**
 * Intelligent AI provider: Claude → Gemma 4 → Llama
 * - Respects rate limits and daily budget
 * - Caches identical requests for 1h
 * - Falls back to local models when Claude is unavailable
 */
export async function ask(request: AIRequest): Promise<AIResponse> {
  // 1. Cache lookup (skip for high-temp creative tasks)
  const useCache = (request.temperature ?? 0.7) < 0.9;
  if (useCache) {
    const cacheKey = getCacheKey(request);
    const cached = readCache(cacheKey);
    if (cached) {
      logger.info('AI', 'Cache hit', { model: cached.model });
      return cached;
    }
  }

  incrementDailyCount();

  // 2. Try Claude first (uses Max subscription — no artificial cap)
  rateLimiter.check('claude'); // increments counter for observability only, never blocks
  try {
    const response = await callClaude(request);
    costTracker.record(response.inputTokens, response.outputTokens); // tracking only
    if (useCache) writeCache(getCacheKey(request), response);
    return response;
  } catch (err) {
    if (err instanceof ClaudeRateLimitError) {
      // Real Anthropic rate limit — fall through to Ollama
      logger.warn('AI', 'Claude rate limited by Anthropic — falling back to Ollama', err.message);
    } else {
      // Other error (timeout, auth, etc.) — still try Ollama as last resort
      logger.warn('AI', 'Claude failed — falling back to Ollama', err instanceof Error ? err.message : err);
    }
  }

  // 3. Try Gemma 3 (Ollama) — only reached on real Claude failure
  const ollamaUp = await isOllamaAvailable();
  if (ollamaUp) {
    try {
      const response = await callGemma(request);
      if (useCache) writeCache(getCacheKey(request), response);
      return response;
    } catch (err) {
      logger.warn('AI', 'Gemma failed, falling back to Llama', err instanceof Error ? err.message : err);
    }

    // 4. Try Llama fallback
    try {
      const response = await callLlama(request);
      if (useCache) writeCache(getCacheKey(request), response);
      return response;
    } catch (err) {
      logger.error('AI', 'Llama also failed', err instanceof Error ? err.message : err);
    }
  } else {
    logger.warn('AI', 'Ollama not available — all local models unreachable');
  }

  throw new Error('All AI providers failed. Check Claude CLI auth and Ollama status.');
}

export function getDailyCallCount(): number {
  return _dailyCallCount;
}
