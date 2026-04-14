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

    CREATE TABLE IF NOT EXISTS marketplace_skills (
      id          TEXT PRIMARY KEY,
      author_id   TEXT NOT NULL,
      author_name TEXT NOT NULL,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      version     TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      downloads   INTEGER NOT NULL DEFAULT 0,
      avg_rating  REAL    NOT NULL DEFAULT 0,
      published   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS skill_ratings (
      id          TEXT PRIMARY KEY,
      skill_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      score       INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(skill_id, user_id),
      FOREIGN KEY(skill_id) REFERENCES marketplace_skills(id)
    );

    CREATE INDEX IF NOT EXISTS idx_msk_slug      ON marketplace_skills(slug);
    CREATE INDEX IF NOT EXISTS idx_msk_rating    ON marketplace_skills(avg_rating DESC);
    CREATE INDEX IF NOT EXISTS idx_msk_downloads ON marketplace_skills(downloads DESC);

    CREATE TABLE IF NOT EXISTS workflows (
      id          TEXT    PRIMARY KEY,
      user_id     TEXT    NOT NULL DEFAULT 'default',
      name        TEXT    NOT NULL,
      description TEXT,
      nodes       TEXT    NOT NULL DEFAULT '[]',
      enabled     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      last_run_at TEXT,
      run_count   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id               TEXT PRIMARY KEY,
      workflow_id      TEXT NOT NULL,
      started_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      finished_at      TEXT,
      status           TEXT NOT NULL CHECK(status IN ('running','completed','failed')),
      final_variables  TEXT NOT NULL DEFAULT '{}',
      error            TEXT,
      FOREIGN KEY(workflow_id) REFERENCES workflows(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_user    ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(enabled);
    CREATE INDEX IF NOT EXISTS idx_runs_workflow     ON workflow_runs(workflow_id, started_at DESC);
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
