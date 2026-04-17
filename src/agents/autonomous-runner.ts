/**
 * MODULE 2 — Boucle autonome
 * Exécute les tâches jusqu'à complétion à 100%.
 * En cas de blocage répété → escalade vers l'utilisateur via Telegram.
 * Attend sa réponse avant de continuer.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { insertAction, insertNotification, getDb } from '../db';
import { AgentTask } from '../types';
import type { AgentResult } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_RETRIES      = 3;          // tentatives avant d'escalader
const RETRY_DELAY_MS   = 30_000;     // 30s entre chaque retry
const ESCALATION_WAIT  = 10 * 60_000; // 10min max d'attente réponse utilisateur
const STATE_PATH       = path.resolve(process.cwd(), 'data', 'autonomous-state.json');

// ─── State persistence ────────────────────────────────────────────────────────

interface BlockedTask {
  task: AgentTask;
  reason: string;
  attempts: number;
  blockedAt: string;
  unblocked: boolean;
  unblockCommand?: 'retry' | 'skip' | 'abort';
  unblockNote?: string;
}

interface AutonomousState {
  blockedTasks: BlockedTask[];
  totalTasksRun: number;
  totalSuccesses: number;
  totalFailures: number;
  lastUpdated: string;
}

function loadState(): AutonomousState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as AutonomousState;
    }
  } catch { /* silent */ }
  return { blockedTasks: [], totalTasksRun: 0, totalSuccesses: 0, totalFailures: 0, lastUpdated: new Date().toISOString() };
}

function saveState(state: AutonomousState): void {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    state.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logger.warn('AutonomousRunner', 'Failed to save state', err);
  }
}

// ─── DB: blocked_tasks table ──────────────────────────────────────────────────

function ensureBlockedTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS blocked_tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task        TEXT    NOT NULL,
      reason      TEXT    NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 1,
      command     TEXT    CHECK(command IN ('retry','skip','abort')),
      note        TEXT,
      resolved    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      resolved_at TEXT
    );
  `);
}

function createBlockedEntry(task: AgentTask, reason: string, attempts: number): number {
  ensureBlockedTable();
  const db = getDb();
  const r = db.prepare(`
    INSERT INTO blocked_tasks (task, reason, attempts) VALUES (?, ?, ?)
  `).run(task, reason, attempts);
  return r.lastInsertRowid as number;
}

function pollForUnblock(id: number): { command: string; note: string } | null {
  ensureBlockedTable();
  const db = getDb();
  const row = db.prepare(`SELECT command, note FROM blocked_tasks WHERE id = ? AND resolved = 1`).get(id) as { command: string; note: string } | undefined;
  return row ?? null;
}

export function resolveBlockedTask(id: number, command: 'retry' | 'skip' | 'abort', note = ''): void {
  ensureBlockedTable();
  getDb().prepare(`
    UPDATE blocked_tasks SET resolved = 1, command = ?, note = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?
  `).run(command, note, id);
  logger.info('AutonomousRunner', `Blocked task #${id} resolved: ${command}`, { note });
}

export function getPendingBlockedTasks(): Array<{ id: number; task: string; reason: string; attempts: number; created_at: string }> {
  try {
    ensureBlockedTable();
    return getDb().prepare(`
      SELECT id, task, reason, attempts, created_at FROM blocked_tasks WHERE resolved = 0 ORDER BY created_at ASC
    `).all() as Array<{ id: number; task: string; reason: string; attempts: number; created_at: string }>;
  } catch { return []; }
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Escalation ───────────────────────────────────────────────────────────────

async function escalateToUser(
  task: AgentTask,
  reason: string,
  attempts: number,
  notifyFn: (msg: string) => Promise<void>
): Promise<'retry' | 'skip' | 'abort'> {
  const blockedId = createBlockedEntry(task, reason, attempts);

  const msg = [
    `🚨 *IntraClaw bloqué — action requise*`,
    ``,
    `📌 Tâche : \`${task}\``,
    `❌ Raison : ${reason}`,
    `🔄 Tentatives : ${attempts}/${MAX_RETRIES}`,
    ``,
    `Réponds avec :`,
    `/unblock ${blockedId} retry — Réessayer`,
    `/unblock ${blockedId} skip — Ignorer et continuer`,
    `/unblock ${blockedId} abort — Annuler la tâche`,
  ].join('\n');

  try {
    await notifyFn(msg);
    logger.warn('AutonomousRunner', `Task ${task} escalated to user. BlockedTask #${blockedId}`);
  } catch (err) {
    logger.error('AutonomousRunner', 'Failed to send escalation notification', err);
  }

  insertNotification('error', `Tâche ${task} bloquée après ${attempts} tentatives: ${reason}`);

  // Poll for response (max ESCALATION_WAIT)
  const deadline = Date.now() + ESCALATION_WAIT;
  while (Date.now() < deadline) {
    await sleep(15_000); // check every 15s
    const resolved = pollForUnblock(blockedId);
    if (resolved) {
      logger.info('AutonomousRunner', `Got unblock command: ${resolved.command}`);
      return resolved.command as 'retry' | 'skip' | 'abort';
    }
  }

  // Timeout — skip by default after 10min
  logger.warn('AutonomousRunner', `Escalation timeout for task ${task} — skipping`);
  resolveBlockedTask(blockedId, 'skip', 'Auto-skip after 10min timeout');
  return 'skip';
}

// ─── Main autonomous runner ───────────────────────────────────────────────────

type TaskRunner = (task: AgentTask) => Promise<AgentResult>;

/**
 * Runs a task autonomously until success.
 * Retries on failure, escalates to user after MAX_RETRIES.
 * Logs every attempt in SQLite.
 *
 * @param task       The task to run
 * @param runner     The actual task executor (coordinator.runTask)
 * @param notifyFn   Function to notify the user (Telegram sendMessage)
 */
export async function runAutonomous(
  task: AgentTask,
  runner: TaskRunner,
  notifyFn: (msg: string) => Promise<void>
): Promise<AgentResult> {
  const state = loadState();
  state.totalTasksRun++;
  saveState(state);

  let attempts = 0;

  while (true) {
    attempts++;
    const actionId = insertAction({ agent: 'autonomous-runner', task, status: 'running' });
    const start = Date.now();

    logger.info('AutonomousRunner', `Attempt ${attempts}/${MAX_RETRIES} for task: ${task}`);

    try {
      const result = await runner(task);
      const durationMs = Date.now() - start;

      if (result.success) {
        // ✅ Success
        getDb().prepare(`
          UPDATE agent_actions SET status = 'success', duration_ms = ?, model = ? WHERE id = ?
        `).run(durationMs, result.model, actionId);

        state.totalSuccesses++;
        saveState(state);

        logger.info('AutonomousRunner', `✅ Task ${task} completed on attempt ${attempts}`, { durationMs });

        // Notify user of success if it took retries
        if (attempts > 1) {
          try {
            await notifyFn(`✅ *Tâche ${task} complétée* après ${attempts} tentatives (${Math.round(durationMs / 1000)}s)`);
          } catch { /* non-blocking */ }
        }

        return result;
      } else {
        // ❌ Task returned failure
        const errorMsg = result.error ?? 'Résultat incorrect';
        getDb().prepare(`
          UPDATE agent_actions SET status = 'error', duration_ms = ?, error = ? WHERE id = ?
        `).run(durationMs, errorMsg, actionId);

        logger.warn('AutonomousRunner', `Task ${task} returned failure on attempt ${attempts}`, errorMsg);

        if (attempts >= MAX_RETRIES) {
          // Escalate
          const command = await escalateToUser(task, errorMsg, attempts, notifyFn);

          if (command === 'retry') {
            attempts = 0; // reset counter after manual unblock
            await sleep(5_000);
            continue;
          } else if (command === 'abort') {
            state.totalFailures++;
            saveState(state);
            return { ...result, error: `Aborted by user after ${attempts} attempts` };
          } else {
            // skip
            state.totalFailures++;
            saveState(state);
            return { ...result, success: false, error: `Skipped after ${attempts} failed attempts` };
          }
        }

        // Retry after delay
        logger.info('AutonomousRunner', `Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);

      getDb().prepare(`
        UPDATE agent_actions SET status = 'error', duration_ms = ?, error = ? WHERE id = ?
      `).run(durationMs, errorMsg, actionId);

      logger.error('AutonomousRunner', `Task ${task} threw exception on attempt ${attempts}`, errorMsg);

      if (attempts >= MAX_RETRIES) {
        const command = await escalateToUser(task, errorMsg, attempts, notifyFn);

        if (command === 'retry') {
          attempts = 0;
          await sleep(5_000);
          continue;
        }

        state.totalFailures++;
        saveState(state);

        return {
          task,
          success: false,
          error: errorMsg,
          durationMs,
          model: 'none',
          timestamp: new Date().toISOString(),
        };
      }

      await sleep(RETRY_DELAY_MS);
    }
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getAutonomousStats(): AutonomousState {
  return loadState();
}
