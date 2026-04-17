import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './utils/logger';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { resolveEffectiveTier, recordSuccess, recordFailure } from './routing/pal-router';
import { callWithFallback, getProviderStatus, getAvailableProviders, refreshProviders } from './providers/multi-provider';
import type { AIRequest, AIResponse } from './types';

// Re-export provider status for dashboard/server
export { getProviderStatus, getAvailableProviders, refreshProviders } from './providers/multi-provider';

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
 * Intelligent AI provider with multi-provider fallback.
 *
 * Priority order (auto-discovered at startup):
 *   1. claude-cli    (if `which claude` works)
 *   2. codex-cli     (if `which codex` works)
 *   3. gemini-cli    (if `which gemini` works)
 *   4. ollama-gemma  (if Ollama is running)
 *   5. ollama-llama  (if Ollama is running)
 *   6. claude-api    (if ANTHROPIC_API_KEY set)
 *   7. openai-api    (if OPENAI_API_KEY set)
 *   8. gemini-api    (if GEMINI_API_KEY set)
 *
 * - Respects rate limits: if a provider returns 429, skips to next
 * - Caches identical requests for 1h
 * - PAL Router: escalates/downgrades tiers based on success/failure streaks
 * - Logs which provider handled each call
 */
export async function ask(request: AIRequest): Promise<AIResponse> {
  // 1. Cache lookup (skip for high-temp creative tasks)
  const useCache = (request.temperature ?? 0.7) < 0.9;
  if (useCache) {
    const cacheKey = getCacheKey(request);
    const cached = readCache(cacheKey);
    if (cached) {
      logger.info('AI', 'Cache hit', { model: cached.model, providerId: cached.providerId });
      return cached;
    }
  }

  incrementDailyCount();

  // 2. PAL Router: resolve effective tier (may escalate or downgrade based on recent history)
  const requestedTier = request.modelTier ?? 'balanced';
  const effectiveTier = resolveEffectiveTier(requestedTier);
  const routedRequest: AIRequest = effectiveTier !== requestedTier
    ? { ...request, modelTier: effectiveTier }
    : request;

  rateLimiter.check('claude'); // increments counter for observability only, never blocks

  // 3. Call providers in priority order with automatic fallback
  try {
    const response = await callWithFallback(routedRequest);
    costTracker.record(response.inputTokens, response.outputTokens); // tracking only
    recordSuccess(effectiveTier);
    logger.info('AI', `Served by ${response.providerId ?? response.model} (tier=${effectiveTier})`);
    if (useCache) writeCache(getCacheKey(request), response);
    return response;
  } catch (err) {
    recordFailure(effectiveTier);
    const message = err instanceof Error ? err.message : String(err);
    logger.error('AI', 'All providers failed', message);
    throw new Error(`All AI providers failed. ${message}`);
  }
}

export function getDailyCallCount(): number {
  return _dailyCallCount;
}
