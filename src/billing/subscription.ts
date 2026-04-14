import { getDb } from '../db';
import type { Subscription, SubscriptionPlan } from './types';

interface SubscriptionRow {
  id: number;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: SubscriptionPlan;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    plan: row.plan,
    status: row.status as Subscription['status'],
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
  };
}

export function getSubscription(userId: string): Subscription | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .get(userId) as SubscriptionRow | undefined;
  return row ? rowToSubscription(row) : null;
}

export function getOrCreateSubscription(userId: string): Subscription {
  const existing = getSubscription(userId);
  if (existing) return existing;

  const db = getDb();
  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status)
    VALUES (?, 'free', 'inactive')
  `).run(userId);

  return getSubscription(userId) as Subscription;
}

export function updateSubscription(
  userId: string,
  updates: Partial<Omit<Subscription, 'id' | 'userId' | 'createdAt'>>,
): Subscription {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.stripeCustomerId !== undefined) {
    fields.push('stripe_customer_id = ?');
    values.push(updates.stripeCustomerId);
  }
  if (updates.stripeSubscriptionId !== undefined) {
    fields.push('stripe_subscription_id = ?');
    values.push(updates.stripeSubscriptionId);
  }
  if (updates.plan !== undefined) {
    fields.push('plan = ?');
    values.push(updates.plan);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.currentPeriodEnd !== undefined) {
    fields.push('current_period_end = ?');
    values.push(updates.currentPeriodEnd);
  }

  if (fields.length === 0) return getOrCreateSubscription(userId);

  values.push(userId);
  db.prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);

  return getOrCreateSubscription(userId);
}

export function getUserPlan(userId: string): SubscriptionPlan {
  const sub = getSubscription(userId);
  return sub?.plan ?? 'free';
}

export function canUserDoTask(userId: string): boolean {
  const sub = getOrCreateSubscription(userId);
  if (sub.plan !== 'free') return true;

  // Free plan: max 50 tasks this month
  const db = getDb();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const row = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM agent_actions
    WHERE created_at >= ?
  `).get(startOfMonth.toISOString()) as { cnt: number };

  return row.cnt < 50;
}
