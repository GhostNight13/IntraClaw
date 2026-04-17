// src/graph/checkpointer.ts
//
// SQLite-backed checkpointer for StateGraph. Persists full state snapshots
// after each node so that execution can resume on restart or crash.
//
// Schema (created lazily on first use):
//   graph_checkpoints(id, thread_id, node_name, state_json, created_at)

import type Database from 'better-sqlite3';
import { getDb } from '../db';
import { logger } from '../utils/logger';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface CheckpointEntry {
  nodeName: string;
  createdAt: string;
}

export interface Checkpointer<S> {
  save(threadId: string, nodeName: string, state: S): Promise<void>;
  loadLatest(threadId: string): Promise<{ state: S; nodeName: string } | null>;
  listHistory(threadId: string, limit?: number): Promise<CheckpointEntry[]>;
  deleteThread(threadId: string): Promise<void>;
}

// ─── SQLite implementation ───────────────────────────────────────────────────

let schemaEnsured = false;

function ensureSchema(db: Database.Database): void {
  if (schemaEnsured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_checkpoints (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      thread_id   TEXT NOT NULL,
      node_name   TEXT NOT NULL,
      state_json  TEXT NOT NULL,
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
      ON graph_checkpoints(thread_id, created_at DESC);
  `);
  schemaEnsured = true;
}

export class SqliteCheckpointer<S> implements Checkpointer<S> {
  private readonly db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
    ensureSchema(this.db);
  }

  async save(threadId: string, nodeName: string, state: S): Promise<void> {
    try {
      const json = JSON.stringify(state);
      this.db
        .prepare(
          `INSERT INTO graph_checkpoints (thread_id, node_name, state_json)
           VALUES (?, ?, ?)`,
        )
        .run(threadId, nodeName, json);
    } catch (err) {
      logger.error(
        'Checkpointer',
        `save failed for thread=${threadId} node=${nodeName}`,
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }

  async loadLatest(threadId: string): Promise<{ state: S; nodeName: string } | null> {
    const row = this.db
      .prepare(
        `SELECT node_name AS nodeName, state_json AS stateJson
         FROM graph_checkpoints
         WHERE thread_id = ?
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(threadId) as { nodeName: string; stateJson: string } | undefined;

    if (!row) return null;
    try {
      return { nodeName: row.nodeName, state: JSON.parse(row.stateJson) as S };
    } catch (err) {
      logger.error(
        'Checkpointer',
        `loadLatest: malformed JSON for thread=${threadId}`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  async listHistory(threadId: string, limit = 100): Promise<CheckpointEntry[]> {
    const rows = this.db
      .prepare(
        `SELECT node_name AS nodeName, created_at AS createdAt
         FROM graph_checkpoints
         WHERE thread_id = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(threadId, limit) as CheckpointEntry[];
    return rows;
  }

  async deleteThread(threadId: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM graph_checkpoints WHERE thread_id = ?`)
      .run(threadId);
  }
}
