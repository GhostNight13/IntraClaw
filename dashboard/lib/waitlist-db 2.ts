import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Shared SQLite file with the backend (src/db.ts). Path is relative to the
// IntraClaw project root, regardless of which app boots first.
const DB_PATH = path.resolve(process.cwd(), '..', 'data', 'intraclaw.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL UNIQUE,
      source      TEXT    NOT NULL DEFAULT 'landing',
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at DESC);
  `);
  // Best-effort: add source column if pre-existing table predates this field.
  try {
    _db.exec(`ALTER TABLE waitlist ADD COLUMN source TEXT NOT NULL DEFAULT 'landing'`);
  } catch {
    // Column already exists — ignore.
  }
  return _db;
}

export interface WaitlistEntry {
  id:         number;
  email:      string;
  source:     string;
  created_at: string;
}

export function listWaitlist(limit = 1000): WaitlistEntry[] {
  return getDb().prepare(
    `SELECT id, email, source, created_at FROM waitlist ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as WaitlistEntry[];
}

export function addWaitlistEmail(email: string): { ok: true; id: number } | { ok: false; error: string } {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: 'Invalid email' };
  }
  try {
    const db = getDb();
    const stmt = db.prepare('INSERT INTO waitlist (email) VALUES (?)');
    const result = stmt.run(trimmed);
    return { ok: true, id: result.lastInsertRowid as number };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('UNIQUE')) {
      return { ok: false, error: 'Email already on waitlist' };
    }
    return { ok: false, error: msg };
  }
}
