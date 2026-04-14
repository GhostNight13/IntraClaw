import * as crypto from 'crypto';
import { getDb } from '../db';

export type ConsentType = 'analytics' | 'marketing' | 'data_processing';

export function recordConsent(userId: string, consentType: ConsentType, granted: boolean, ipAddress?: string): void {
  const db = getDb();
  const id = crypto.randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO consent_records (id, user_id, consent_type, granted, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, consentType, granted ? 1 : 0, ipAddress ?? null);
}

export function getConsents(userId: string): Record<ConsentType, boolean> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT consent_type, granted FROM consent_records WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as { consent_type: string; granted: number }[];

  const seen = new Set<string>();
  const result: Record<string, boolean> = {};
  for (const row of rows) {
    if (!seen.has(row.consent_type)) {
      result[row.consent_type] = !!(row.granted);
      seen.add(row.consent_type);
    }
  }
  return result as Record<ConsentType, boolean>;
}
