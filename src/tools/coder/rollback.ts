import * as fs from 'fs';
import * as crypto from 'crypto';
import { getDb } from '../../db';
import { logger } from '../../utils/logger';
import type { Snapshot } from './types';

export function takeSnapshot(filePath: string): Snapshot {
  const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const id = crypto.randomBytes(8).toString('hex');
  const createdAt = new Date().toISOString();

  getDb().prepare(`
    INSERT INTO file_snapshots (id, file_path, content, created_at) VALUES (?, ?, ?, ?)
  `).run(id, filePath, content, createdAt);

  logger.info('Coder', `Snapshot taken: ${filePath} (${id})`);
  return { id, filePath, content, createdAt };
}

export function listSnapshots(filePath: string): Snapshot[] {
  return getDb().prepare(
    'SELECT id, file_path as filePath, content, created_at as createdAt FROM file_snapshots WHERE file_path = ? ORDER BY created_at DESC LIMIT 20'
  ).all(filePath) as Snapshot[];
}

export function getSnapshot(id: string): Snapshot | null {
  return getDb().prepare(
    'SELECT id, file_path as filePath, content, created_at as createdAt FROM file_snapshots WHERE id = ?'
  ).get(id) as Snapshot | null;
}

export function rollbackToSnapshot(snapshotId: string): void {
  const snap = getSnapshot(snapshotId);
  if (!snap) throw new Error(`Snapshot ${snapshotId} not found`);
  fs.writeFileSync(snap.filePath, snap.content, 'utf8');
  logger.info('Coder', `Rolled back ${snap.filePath} to snapshot ${snapshotId}`);
}
