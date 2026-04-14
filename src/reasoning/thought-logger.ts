/**
 * INTRACLAW — Thought Logger
 * Captures and stores agent reasoning steps for CoT visualization
 */
import { getDb } from '../db';
import { sseManager } from '../streaming/sse-manager';
import type { ThoughtEvent, ThoughtEventType } from '../streaming/sse-manager';

export interface ThoughtStep {
  id: string;
  taskId: string;
  type: ThoughtEventType;
  content: string;
  stepIndex: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

let stepCounters = new Map<string, number>();

function nextStep(taskId: string): number {
  const current = stepCounters.get(taskId) ?? 0;
  stepCounters.set(taskId, current + 1);
  return current;
}

export function logThought(
  taskId: string,
  type: ThoughtEventType,
  content: string,
  metadata?: Record<string, unknown>
): void {
  const stepIndex = nextStep(taskId);
  const timestamp = new Date().toISOString();

  // Persist to DB
  try {
    const db = getDb();
    const id = `thought-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(`
      INSERT INTO thought_log (id, task_id, type, content, step_index, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, type, content, stepIndex, JSON.stringify(metadata ?? {}), timestamp);
  } catch {
    // Non-fatal: table may not exist yet
  }

  // Stream to SSE clients
  const event: ThoughtEvent = {
    type,
    content,
    timestamp,
    taskId,
    stepIndex,
    metadata,
  };
  sseManager.broadcast(event);
}

export function logToolCall(taskId: string, toolName: string, args: unknown): void {
  logThought(taskId, 'tool_call', `Calling ${toolName}`, { tool: toolName, args });
}

export function logToolResult(taskId: string, toolName: string, result: unknown): void {
  const preview = typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200);
  logThought(taskId, 'tool_result', `${toolName} returned: ${preview}`, { tool: toolName });
}

export function logStep(taskId: string, description: string): void {
  logThought(taskId, 'step', description);
}

export function logThinking(taskId: string, thought: string): void {
  logThought(taskId, 'thinking', thought);
}

export function logDone(taskId: string, summary: string): void {
  logThought(taskId, 'done', summary);
  stepCounters.delete(taskId); // cleanup
}

export function getThoughts(taskId: string): ThoughtStep[] {
  try {
    const db = getDb();
    return db.prepare(`
      SELECT id, task_id as taskId, type, content, step_index as stepIndex, metadata, created_at as createdAt
      FROM thought_log WHERE task_id = ? ORDER BY step_index ASC
    `).all(taskId) as ThoughtStep[];
  } catch {
    return [];
  }
}

export function getRecentThoughts(limit = 50): ThoughtStep[] {
  try {
    const db = getDb();
    return db.prepare(`
      SELECT id, task_id as taskId, type, content, step_index as stepIndex, metadata, created_at as createdAt
      FROM thought_log ORDER BY created_at DESC LIMIT ?
    `).all(limit) as ThoughtStep[];
  } catch {
    return [];
  }
}
