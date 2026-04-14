import { randomUUID } from 'crypto';
import { getDb } from '../db';
import type { WorkflowDefinition, WorkflowRunLog } from './types';

// ─── Row types ────────────────────────────────────────────────────────────────

interface WorkflowRow {
  id:          string;
  user_id:     string;
  name:        string;
  description: string | null;
  nodes:       string;
  enabled:     number;
  created_at:  string;
  last_run_at: string | null;
  run_count:   number;
}

interface RunRow {
  id:               string;
  workflow_id:      string;
  started_at:       string;
  finished_at:      string | null;
  status:           string;
  final_variables:  string;
  error:            string | null;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

function rowToDefinition(row: WorkflowRow): WorkflowDefinition {
  return {
    id:          row.id,
    userId:      row.user_id,
    name:        row.name,
    description: row.description ?? undefined,
    nodes:       JSON.parse(row.nodes),
    enabled:     row.enabled === 1,
    createdAt:   row.created_at,
    lastRunAt:   row.last_run_at ?? undefined,
    runCount:    row.run_count,
  };
}

function rowToRunLog(row: RunRow): WorkflowRunLog {
  const vars = JSON.parse(row.final_variables ?? '{}') as {
    variables?: Record<string, unknown>;
    logs?: WorkflowRunLog['logs'];
    nodeId?: string;
  };
  return {
    workflowId: row.workflow_id,
    startedAt:  row.started_at,
    finishedAt: row.finished_at ?? undefined,
    status:     row.status as WorkflowRunLog['status'],
    nodeId:     vars.nodeId ?? '',
    variables:  vars.variables ?? {},
    logs:       vars.logs ?? [],
    error:      row.error ?? undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listWorkflows(userId?: string): WorkflowDefinition[] {
  const db = getDb();
  const rows = userId
    ? (db.prepare(`SELECT * FROM workflows WHERE user_id = ? ORDER BY created_at DESC`).all(userId) as WorkflowRow[])
    : (db.prepare(`SELECT * FROM workflows ORDER BY created_at DESC`).all() as WorkflowRow[]);
  return rows.map(rowToDefinition);
}

export function getWorkflow(id: string): WorkflowDefinition | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as WorkflowRow | undefined;
  return row ? rowToDefinition(row) : null;
}

export function createWorkflow(data: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'runCount'>): WorkflowDefinition {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO workflows (id, user_id, name, description, nodes, enabled, created_at, run_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, data.userId, data.name, data.description ?? null, JSON.stringify(data.nodes), data.enabled ? 1 : 0, now);
  return getWorkflow(id)!;
}

export function updateWorkflow(id: string, patch: Partial<WorkflowDefinition>): WorkflowDefinition {
  const db = getDb();
  const existing = getWorkflow(id);
  if (!existing) throw new Error(`Workflow not found: ${id}`);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.name !== undefined)        { fields.push('name = ?');        values.push(patch.name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.nodes !== undefined)       { fields.push('nodes = ?');       values.push(JSON.stringify(patch.nodes)); }
  if (patch.enabled !== undefined)     { fields.push('enabled = ?');     values.push(patch.enabled ? 1 : 0); }

  if (fields.length === 0) return existing;

  values.push(id);
  db.prepare(`UPDATE workflows SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getWorkflow(id)!;
}

export function deleteWorkflow(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM workflow_runs WHERE workflow_id = ?`).run(id);
  db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id);
}

export function recordRun(
  workflowId: string,
  status: 'completed' | 'failed',
  runLog: WorkflowRunLog,
  error?: string,
): void {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO workflow_runs (id, workflow_id, started_at, finished_at, status, final_variables, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workflowId,
    runLog.startedAt,
    now,
    status,
    JSON.stringify({ variables: runLog.variables, logs: runLog.logs, nodeId: runLog.nodeId }),
    error ?? null,
  );

  db.prepare(`
    UPDATE workflows SET last_run_at = ?, run_count = run_count + 1 WHERE id = ?
  `).run(now, workflowId);
}

export function getRunLogs(workflowId: string, limit = 20): WorkflowRunLog[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?
  `).all(workflowId, limit) as RunRow[];
  return rows.map(rowToRunLog);
}
