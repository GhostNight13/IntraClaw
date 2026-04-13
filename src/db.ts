import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './utils/logger';

const DB_PATH = path.resolve(process.cwd(), 'data', 'intraclaw.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  migrate(_db);
  logger.info('DB', `SQLite ready: ${DB_PATH}`);
  return _db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_actions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent       TEXT    NOT NULL,
      task        TEXT    NOT NULL,
      status      TEXT    NOT NULL CHECK(status IN ('running','success','error')),
      duration_ms INTEGER,
      model       TEXT,
      cost_eur    REAL    DEFAULT 0,
      error       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL CHECK(type IN ('info','warn','error')),
      message    TEXT NOT NULL,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_actions_created  ON agent_actions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notif_read       ON notifications(read, created_at DESC);
  `);
}

// ─── Write helpers ─────────────────────────────────────────────────────────────

export interface ActionRow {
  agent: string;
  task: string;
  status: 'running' | 'success' | 'error';
  duration_ms?: number;
  model?: string;
  cost_eur?: number;
  error?: string;
}

export function insertAction(row: ActionRow): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO agent_actions (agent, task, status, duration_ms, model, cost_eur, error)
    VALUES (@agent, @task, @status, @duration_ms, @model, @cost_eur, @error)
  `);
  const result = stmt.run(row);
  return result.lastInsertRowid as number;
}

export function insertNotification(type: 'info' | 'warn' | 'error', message: string): number {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO notifications (type, message) VALUES (?, ?)`
  );
  const result = stmt.run(type, message);
  return result.lastInsertRowid as number;
}

export function getRecentActions(limit = 50): ActionRow[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM agent_actions ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as ActionRow[];
}

export function getUnreadNotifications(): unknown[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC`
  ).all();
}

export function markNotificationsRead(): void {
  getDb().prepare(`UPDATE notifications SET read = 1 WHERE read = 0`).run();
}

export interface ActionRecord {
  id: number;
  task: string;
  status: 'running' | 'success' | 'error';
  timestamp: string;
  durationMs: number | null;
  error: string | null;
}

export function getActions(limit = 50): ActionRecord[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, task, status, created_at AS timestamp, duration_ms AS durationMs, error FROM agent_actions ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as ActionRecord[];
}
