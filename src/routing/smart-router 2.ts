// src/routing/smart-router.ts
// Smart Model Routing — determines the right model tier based on request complexity
// No LLM call for routing; pure pattern matching for speed.
import { logger } from '../utils/logger';
import type { ModelTier } from '../types';

// ─── Keyword sets ────────────────────────────────────────────────────────────

/** Requests that need the most capable model */
const POWERFUL_KEYWORDS: string[] = [
  // Coding / architecture
  'code', 'debug', 'refactor', 'architect', 'implement', 'optimize', 'algorithm',
  'migration', 'deploy', 'database', 'schema', 'api design', 'system design',
  'security audit', 'performance', 'typescript', 'python', 'rust', 'golang',
  'microservice', 'infrastructure', 'ci/cd', 'kubernetes', 'docker',
  // Complex reasoning
  'analyze', 'compare', 'evaluate', 'strategy', 'plan', 'research',
  'write report', 'business plan', 'financial model', 'legal',
  'deep dive', 'root cause', 'postmortem',
  // Long-form content
  'write article', 'write blog', 'documentation', 'technical spec',
  'proposal', 'white paper',
];

/** Requests that can use the fastest/cheapest model */
const FAST_KEYWORDS: string[] = [
  // Simple queries
  'hello', 'hi', 'hey', 'thanks', 'thank you', 'merci', 'bonjour', 'salut',
  'ok', 'yes', 'no', 'sure', 'got it',
  // Quick lookups
  'what time', 'what date', 'weather', 'remind me', 'set timer', 'set alarm',
  'convert', 'calculate', 'how much is', 'translate',
  // Simple actions
  'turn on', 'turn off', 'toggle', 'open', 'close', 'play', 'pause', 'stop',
  'send message', 'quick note', 'add to list',
  // Status checks
  'status', 'ping', 'health check', 'uptime',
];

/** Additional signals that push toward powerful tier */
const COMPLEXITY_SIGNALS: RegExp[] = [
  /\bfix\s+(this|the|a)\s+bug\b/i,
  /\bwrite\s+(a|the)\s+(function|class|module|component|service)\b/i,
  /\bcreate\s+(a|the)\s+(project|app|application|website|api)\b/i,
  /\bmulti[- ]?step\b/i,
  /\b(end[- ]?to[- ]?end|e2e)\b/i,
  /\bfrom\s+scratch\b/i,
  /\bgenerate\s+(a\s+)?complete\b/i,
  /\breview\s+(this|the|my)\s+(code|pr|pull\s+request)\b/i,
];

/** Signals that push toward fast tier */
const SIMPLE_SIGNALS: RegExp[] = [
  /^(yes|no|ok|sure|thanks?|merci|oui|non)[\s!.]*$/i,
  /^what('s| is) (the )?(time|date|day)\??$/i,
  /^(hello|hi|hey|bonjour|salut)[\s!.]*$/i,
];

// ─── Scoring engine ──────────────────────────────────────────────────────────

interface RoutingAnalysis {
  tier: ModelTier;
  score: number;        // -1 (fast) to +1 (powerful), 0 = balanced
  reason: string;
  keywords: string[];   // matched keywords
}

function computeScore(request: string): RoutingAnalysis {
  const lower = request.toLowerCase().trim();
  const matchedKeywords: string[] = [];
  let score = 0;

  // Check simple signals first (strongest fast indicators)
  for (const pattern of SIMPLE_SIGNALS) {
    if (pattern.test(lower)) {
      return { tier: 'fast', score: -1, reason: 'Simple response pattern', keywords: [] };
    }
  }

  // Check complexity signals (strongest powerful indicators)
  for (const pattern of COMPLEXITY_SIGNALS) {
    if (pattern.test(lower)) {
      score += 0.3;
      const match = lower.match(pattern);
      if (match) matchedKeywords.push(match[0]);
    }
  }

  // Check powerful keywords
  for (const kw of POWERFUL_KEYWORDS) {
    if (lower.includes(kw)) {
      score += 0.15;
      matchedKeywords.push(kw);
    }
  }

  // Check fast keywords
  for (const kw of FAST_KEYWORDS) {
    if (lower.includes(kw)) {
      score -= 0.2;
      matchedKeywords.push(kw);
    }
  }

  // Length heuristic: very short requests tend to be simple
  if (lower.length < 20) score -= 0.15;
  if (lower.length > 200) score += 0.1;
  if (lower.length > 500) score += 0.15;

  // Question mark count: more questions = more complex
  const questionMarks = (request.match(/\?/g) || []).length;
  if (questionMarks >= 3) score += 0.1;

  // Code block presence
  if (request.includes('```') || request.includes('function ') || request.includes('class ')) {
    score += 0.2;
    matchedKeywords.push('code-block');
  }

  // Clamp score
  score = Math.max(-1, Math.min(1, score));

  // Determine tier from score
  let tier: ModelTier;
  let reason: string;

  if (score >= 0.3) {
    tier = 'powerful';
    reason = `High complexity (score: ${score.toFixed(2)})`;
  } else if (score <= -0.2) {
    tier = 'fast';
    reason = `Low complexity (score: ${score.toFixed(2)})`;
  } else {
    tier = 'balanced';
    reason = `Medium complexity (score: ${score.toFixed(2)})`;
  }

  return { tier, score, reason, keywords: matchedKeywords };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Determine the optimal model tier for a given request.
 * Pure pattern matching — no LLM call, ~0ms latency.
 */
export function determineModelTier(request: string): ModelTier {
  const analysis = analyzeRequest(request);
  logger.info('SmartRouter', `"${request.slice(0, 60)}..." → ${analysis.tier} (${analysis.reason})`);
  return analysis.tier;
}

/**
 * Full analysis with scoring details (useful for debugging/dashboard).
 */
export function analyzeRequest(request: string): RoutingAnalysis {
  return computeScore(request);
}

/**
 * Get all keyword lists for introspection/testing.
 */
export function getRoutingKeywords(): { powerful: string[]; fast: string[] } {
  return {
    powerful: [...POWERFUL_KEYWORDS],
    fast: [...FAST_KEYWORDS],
  };
}
