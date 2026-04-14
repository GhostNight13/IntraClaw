/**
 * INTRACLAW — Budget Manager
 * Per-user daily/monthly budget enforcement
 */
import { getDb } from '../db';

export interface BudgetStatus {
  userId: string;
  dailyLimit: number;
  monthlyLimit: number;
  currentDaily: number;
  currentMonthly: number;
  alertThreshold: number;
  remainingDaily: number;
  remainingMonthly: number;
  percentUsedDaily: number;
  percentUsedMonthly: number;
  alertTriggered: boolean;
}

export interface BudgetReport {
  userId: string;
  dailyEur: number;
  monthlyEur: number;
  currentDaily: number;
  currentMonthly: number;
  resetAt: string;
}

export function ensureUserBudget(userId: string): void {
  const db = getDb();
  const exists = db.prepare('SELECT id FROM user_budgets WHERE user_id = ?').get(userId);
  if (!exists) {
    db.prepare(`
      INSERT INTO user_budgets (user_id, daily_eur, monthly_eur, current_daily, current_monthly, alert_threshold, reset_at)
      VALUES (?, 5.0, 50.0, 0, 0, 0.8, datetime('now', '+1 day'))
    `).run(userId);
  }
}

export function checkBudget(userId: string): { allowed: boolean; remaining: number; reason?: string } {
  const db = getDb();
  ensureUserBudget(userId);

  const budget = db.prepare('SELECT * FROM user_budgets WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!budget) return { allowed: true, remaining: 999 };

  // Auto-reset if past reset time
  const now = new Date();
  const resetAt = new Date(budget.reset_at as string);
  if (now > resetAt) {
    db.prepare(`
      UPDATE user_budgets SET current_daily = 0, reset_at = datetime('now', '+1 day') WHERE user_id = ?
    `).run(userId);
    (budget as Record<string, unknown>).current_daily = 0;
  }

  const dailyRemaining = (budget.daily_eur as number) - (budget.current_daily as number);
  const monthlyRemaining = (budget.monthly_eur as number) - (budget.current_monthly as number);

  if (dailyRemaining <= 0) return { allowed: false, remaining: 0, reason: 'Daily budget exceeded' };
  if (monthlyRemaining <= 0) return { allowed: false, remaining: 0, reason: 'Monthly budget exceeded' };

  return { allowed: true, remaining: Math.min(dailyRemaining, monthlyRemaining) };
}

export function recordUsage(userId: string, costEur: number): void {
  const db = getDb();
  ensureUserBudget(userId);
  db.prepare(`
    UPDATE user_budgets
    SET current_daily = current_daily + ?, current_monthly = current_monthly + ?
    WHERE user_id = ?
  `).run(costEur, costEur, userId);
}

export function getBudgetStatus(userId: string): BudgetStatus {
  const db = getDb();
  ensureUserBudget(userId);
  const b = db.prepare('SELECT * FROM user_budgets WHERE user_id = ?').get(userId) as Record<string, unknown>;

  const dailyLimit = b.daily_eur as number;
  const monthlyLimit = b.monthly_eur as number;
  const currentDaily = b.current_daily as number;
  const currentMonthly = b.current_monthly as number;
  const alertThreshold = b.alert_threshold as number;

  return {
    userId,
    dailyLimit,
    monthlyLimit,
    currentDaily,
    currentMonthly,
    alertThreshold,
    remainingDaily: Math.max(0, dailyLimit - currentDaily),
    remainingMonthly: Math.max(0, monthlyLimit - currentMonthly),
    percentUsedDaily: dailyLimit > 0 ? currentDaily / dailyLimit : 0,
    percentUsedMonthly: monthlyLimit > 0 ? currentMonthly / monthlyLimit : 0,
    alertTriggered: (currentDaily / dailyLimit) >= alertThreshold || (currentMonthly / monthlyLimit) >= alertThreshold,
  };
}

export function getBudgetReport(): BudgetReport[] {
  const db = getDb();
  return db.prepare('SELECT user_id, daily_eur, monthly_eur, current_daily, current_monthly, reset_at FROM user_budgets ORDER BY current_daily DESC').all() as BudgetReport[];
}

export function updateBudget(userId: string, dailyEur: number, monthlyEur: number, alertThreshold = 0.8): void {
  const db = getDb();
  ensureUserBudget(userId);
  db.prepare(`
    UPDATE user_budgets SET daily_eur = ?, monthly_eur = ?, alert_threshold = ? WHERE user_id = ?
  `).run(dailyEur, monthlyEur, alertThreshold, userId);
}
