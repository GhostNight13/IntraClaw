// src/routing/pal-router.ts
// Progressive Adaptive LLM Router — escalade on failure, downgrade on success
import { logger } from '../utils/logger';
import type { ModelTier } from '../types';

const ESCALATION_THRESHOLD = 2;   // 2 consecutive failures → escalate
const DOWNGRADE_THRESHOLD  = 5;   // 5 consecutive successes → downgrade

const TIER_ORDER: ModelTier[] = ['fast', 'balanced', 'powerful'];

interface TierState {
  consecutiveSuccesses: number;
  consecutiveFailures: number;
  totalCalls: number;
  totalSuccesses: number;
  totalFailures: number;
  lastEscalatedAt?: string;
  lastDowngradedAt?: string;
}

const _state: Record<ModelTier, TierState> = {
  fast:     { consecutiveSuccesses: 0, consecutiveFailures: 0, totalCalls: 0, totalSuccesses: 0, totalFailures: 0 },
  balanced: { consecutiveSuccesses: 0, consecutiveFailures: 0, totalCalls: 0, totalSuccesses: 0, totalFailures: 0 },
  powerful: { consecutiveSuccesses: 0, consecutiveFailures: 0, totalCalls: 0, totalSuccesses: 0, totalFailures: 0 },
};

/**
 * Resolve which tier to actually use, considering escalation/downgrade state.
 */
export function resolveEffectiveTier(requestedTier: ModelTier): ModelTier {
  const state = _state[requestedTier];
  const tierIndex = TIER_ORDER.indexOf(requestedTier);

  // Check if we should escalate (too many failures at this tier)
  if (state.consecutiveFailures >= ESCALATION_THRESHOLD && tierIndex < TIER_ORDER.length - 1) {
    const escalatedTier = TIER_ORDER[tierIndex + 1];
    logger.info('PALRouter', `Escalating ${requestedTier} → ${escalatedTier} (${state.consecutiveFailures} consecutive failures)`);
    return escalatedTier;
  }

  // Check if we should downgrade (many successes, we can use a cheaper model)
  if (state.consecutiveSuccesses >= DOWNGRADE_THRESHOLD && tierIndex > 0) {
    const downgradedTier = TIER_ORDER[tierIndex - 1];
    logger.info('PALRouter', `Downgrading ${requestedTier} → ${downgradedTier} (${state.consecutiveSuccesses} consecutive successes)`);
    return downgradedTier;
  }

  return requestedTier;
}

/**
 * Record a success for a tier. Resets failure counter.
 */
export function recordSuccess(tier: ModelTier): void {
  const state = _state[tier];
  state.consecutiveSuccesses++;
  state.consecutiveFailures = 0;
  state.totalCalls++;
  state.totalSuccesses++;

  if (state.consecutiveSuccesses === DOWNGRADE_THRESHOLD) {
    state.lastDowngradedAt = new Date().toISOString();
  }
}

/**
 * Record a failure for a tier. Resets success counter.
 */
export function recordFailure(tier: ModelTier): void {
  const state = _state[tier];
  state.consecutiveFailures++;
  state.consecutiveSuccesses = 0;
  state.totalCalls++;
  state.totalFailures++;

  if (state.consecutiveFailures === ESCALATION_THRESHOLD) {
    state.lastEscalatedAt = new Date().toISOString();
  }
}

/**
 * Reset counters for a tier (e.g., after escalation/downgrade takes effect).
 */
export function resetTierCounters(tier: ModelTier): void {
  _state[tier].consecutiveSuccesses = 0;
  _state[tier].consecutiveFailures = 0;
}

/**
 * Get stats for all tiers (for dashboard/logging).
 */
export function getRouterStats(): Record<ModelTier, TierState> {
  return JSON.parse(JSON.stringify(_state));
}

/**
 * Get a human-readable status.
 */
export function getRouterStatus(): string {
  const lines: string[] = ['PAL Router Status:'];
  for (const tier of TIER_ORDER) {
    const s = _state[tier];
    const successRate = s.totalCalls > 0 ? ((s.totalSuccesses / s.totalCalls) * 100).toFixed(0) : '—';
    lines.push(`  ${tier}: ${s.totalCalls} calls, ${successRate}% success, streak: +${s.consecutiveSuccesses}/-${s.consecutiveFailures}`);
  }
  return lines.join('\n');
}
