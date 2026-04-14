/**
 * INTRACLAW — Prompt Cache Manager
 * Adds cache_control breakpoints to reduce API costs 60-80%
 */

export interface CacheBreakpoint {
  position: 'system' | 'last_user' | 'tools';
  type: 'ephemeral';
}

export interface CachedMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; cache_control?: { type: 'ephemeral' } }>;
}

/**
 * Wraps a system prompt with cache_control for Anthropic prompt caching
 */
export function wrapSystemWithCache(text: string): Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> {
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

/**
 * Wraps the last user message with cache_control
 */
export function wrapLastUserMessageWithCache(content: string): Array<{ type: 'text'; text: string; cache_control: { type: 'ephemeral' } }> {
  return [{ type: 'text', text: content, cache_control: { type: 'ephemeral' } }];
}

/**
 * Estimates cache savings for a prompt
 */
export function estimateCacheSavings(tokenCount: number, hitRate = 0.7): { savedTokens: number; savedEur: number } {
  const cachedCostPerToken = 0.000003; // €0.003 per 1K input tokens (cached)
  const normalCostPerToken = 0.000015; // €0.015 per 1K input tokens (uncached)
  const savedTokens = Math.round(tokenCount * hitRate);
  const savedEur = savedTokens * (normalCostPerToken - cachedCostPerToken);
  return { savedTokens, savedEur };
}
