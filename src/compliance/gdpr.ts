import { getDb } from '../db';
import { logger } from '../utils/logger';

export function exportUserData(userId: string): Record<string, unknown> {
  const db = getDb();
  return {
    actions: db.prepare('SELECT * FROM agent_actions WHERE agent = ?').all(userId),
    auditLog: db.prepare('SELECT * FROM audit_log WHERE user_id = ?').all(userId),
    oauthAccounts: db.prepare('SELECT provider, email, created_at FROM oauth_accounts WHERE user_id = ?').all(userId),
    budgets: db.prepare('SELECT * FROM user_budgets WHERE user_id = ?').all(userId),
    exportedAt: new Date().toISOString(),
  };
}

export function deleteUserData(userId: string): { deleted: Record<string, number> } {
  const db = getDb();
  const counts: Record<string, number> = {};

  const tables: Array<{ table: string; col: string }> = [
    { table: 'oauth_accounts', col: 'user_id' },
    { table: 'audit_log', col: 'user_id' },
    { table: 'user_budgets', col: 'user_id' },
    { table: 'user_2fa', col: 'user_id' },
  ];

  for (const { table, col } of tables) {
    try {
      const result = db.prepare(`DELETE FROM ${table} WHERE ${col} = ?`).run(userId);
      counts[table] = result.changes;
    } catch { counts[table] = 0; }
  }

  logger.info('GDPR', `User data deleted for ${userId}: ${JSON.stringify(counts)}`);
  return { deleted: counts };
}
