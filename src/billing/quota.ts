/**
 * Usage metering and quota enforcement.
 *
 * Tracks billable actions per user and throws QuotaExceededError when the
 * subscriber's plan limit is reached.
 */
import { getDb } from '../db';
import { getOrCreateSubscription } from './subscription';
import { PLANS, type SubscriptionPlan } from './types';

export type QuotaAction = 'loop_tick' | 'task';

export class QuotaExceededError extends Error {
  public readonly action: QuotaAction;
  public readonly plan: SubscriptionPlan;
  public readonly used: number;
  public readonly limit: number;

  constructor(action: QuotaAction, plan: SubscriptionPlan, used: number, limit: number) {
    super(`Quota exceeded for "${action}" on plan "${plan}": ${used}/${limit}`);
    this.name = 'QuotaExceededError';
    this.action = action;
    this.plan = plan;
    this.used = used;
    this.limit = limit;
  }
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Loop ticks executed by `userId` since local midnight. */
export function getTicksUsedToday(userId: string): number {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) AS cnt FROM loop_tick_log WHERE user_id = ? AND created_at >= ?')
    .get(userId, startOfTodayIso()) as { cnt: number };
  return row.cnt;
}

function recordTick(userId: string): void {
  const db = getDb();
  db.prepare('INSERT INTO loop_tick_log (user_id) VALUES (?)').run(userId);
}

/**
 * Throws {@link QuotaExceededError} when the user has consumed their plan's
 * daily budget for `action`. Records usage on success.
 *
 * Currently supported: 'loop_tick' (free = 10/day, paid = unlimited).
 * Other actions are no-ops for now but the surface is ready to extend.
 */
export function checkQuota(userId: string, action: QuotaAction): void {
  const sub = getOrCreateSubscription(userId);
  const plan = sub.plan;
  const features = PLANS[plan];

  if (action === 'loop_tick') {
    const limit = features.loopTicksPerDay;
    if (limit !== -1) {
      const used = getTicksUsedToday(userId);
      if (used >= limit) {
        throw new QuotaExceededError('loop_tick', plan, used, limit);
      }
    }
    recordTick(userId);
    return;
  }

  // 'task' (and future actions) — no per-day cap right now; subscription.canUserDoTask
  // already enforces the monthly cap from the legacy free plan.
}
