import * as crypto from 'crypto';
import { getDb } from '../db';

export function logAuditEvent(
  action: string,
  options: { userId?: string; resource?: string; resourceId?: string; ipAddress?: string; metadata?: Record<string, unknown> } = {}
): void {
  try {
    const db = getDb();
    const id = crypto.randomBytes(8).toString('hex');
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, resource, resource_id, ip_address, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      options.userId ?? null,
      action,
      options.resource ?? null,
      options.resourceId ?? null,
      options.ipAddress ?? null,
      JSON.stringify(options.metadata ?? {})
    );
  } catch { /* Non-fatal */ }
}

export function getAuditLog(limit = 500): Record<string, unknown>[] {
  return getDb().prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
}
