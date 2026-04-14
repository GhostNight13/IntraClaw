import { getDb } from '../db';
import * as crypto from 'crypto';
import type { WebhookConfig } from './types';
import { logger } from '../utils/logger';

function genId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function genSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function createWebhook(name: string, eventType: WebhookConfig['eventType']): { webhook: WebhookConfig; secret: string } {
  const db = getDb();
  const id = genId();
  const secret = genSecret();
  const urlPath = `/webhooks/${id}`;

  db.prepare(`
    INSERT INTO webhooks (id, name, secret, url_path, event_type, enabled)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, name, secret, urlPath, eventType);

  logger.info('Webhooks', `Created webhook: ${name} (${id})`);
  return {
    webhook: getWebhook(id)!,
    secret, // Only returned once at creation
  };
}

export function getWebhook(id: string): WebhookConfig | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    name: row.name as string,
    secret: row.secret as string,
    urlPath: row.url_path as string,
    eventType: row.event_type as WebhookConfig['eventType'],
    enabled: !!(row.enabled),
    createdAt: row.created_at as string,
    lastFiredAt: row.last_fired_at as string | null,
    fireCount: row.fire_count as number,
  };
}

export function listWebhooks(): Omit<WebhookConfig, 'secret'>[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, url_path, event_type, enabled, created_at, last_fired_at, fire_count FROM webhooks ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    urlPath: row.url_path as string,
    eventType: row.event_type as WebhookConfig['eventType'],
    enabled: !!(row.enabled),
    createdAt: row.created_at as string,
    lastFiredAt: row.last_fired_at as string | null,
    fireCount: row.fire_count as number,
  }));
}

export function deleteWebhook(id: string): void {
  getDb().prepare('DELETE FROM webhooks WHERE id = ?').run(id);
}

export function getWebhookLogs(webhookId: string, limit = 100): Record<string, unknown>[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, webhook_id, status, error, created_at FROM webhook_fire_log WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(webhookId, limit) as Record<string, unknown>[];
}

export function recordFire(webhookId: string, status: 'success' | 'error', error?: string): void {
  const db = getDb();
  const id = genId();
  db.prepare(`
    INSERT INTO webhook_fire_log (id, webhook_id, status, error) VALUES (?, ?, ?, ?)
  `).run(id, webhookId, status, error ?? null);
  db.prepare(`
    UPDATE webhooks SET last_fired_at = datetime('now'), fire_count = fire_count + 1 WHERE id = ?
  `).run(webhookId);
}
