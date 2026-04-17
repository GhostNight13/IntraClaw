// src/executor/graph-executor.ts
//
// Drop-in graph-based executor that wraps the universal task StateGraph
// with SQLite checkpointing. Lives alongside executeUniversalTask; enable
// via GRAPH_EXECUTOR_ENABLED=true (or call executeWithGraph directly).

import { logger } from '../utils/logger';
import { SqliteCheckpointer } from '../graph/checkpointer';
import {
  buildTaskGraph,
  createInitialTaskState,
  type TaskState,
} from '../graph/task-graph';

// Shared compiled graph + checkpointer — building each time would be wasteful.
let cachedGraph: ReturnType<typeof buildTaskGraph> | null = null;
let cachedCheckpointer: SqliteCheckpointer<TaskState> | null = null;

function getGraph(): ReturnType<typeof buildTaskGraph> {
  if (!cachedGraph) cachedGraph = buildTaskGraph();
  return cachedGraph;
}

export function getCheckpointer(): SqliteCheckpointer<TaskState> {
  if (!cachedCheckpointer) cachedCheckpointer = new SqliteCheckpointer<TaskState>();
  return cachedCheckpointer;
}

/** Is the graph executor enabled via env flag? */
export function isGraphExecutorEnabled(): boolean {
  return (process.env.GRAPH_EXECUTOR_ENABLED ?? '').toLowerCase() === 'true';
}

/**
 * Execute a task through the StateGraph with checkpointing.
 * @param request  Natural-language task request.
 * @param threadId Optional thread id; auto-generated if omitted.
 */
export async function executeWithGraph(request: string, threadId?: string): Promise<TaskState> {
  const id = threadId ?? `graph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const graph = getGraph();
  const checkpointer = getCheckpointer();
  const initial = createInitialTaskState(request, id);

  logger.info('GraphExecutor', `▶ start task thread=${id}: "${request.slice(0, 80)}"`);
  try {
    const finalState = await graph.invoke(initial, { threadId: id, checkpointer });
    logger.info('GraphExecutor', `✓ done thread=${id} status=${finalState.status}`);
    return finalState;
  } catch (err) {
    logger.error('GraphExecutor', `✗ thread=${id} failed`, err instanceof Error ? err.message : err);
    const fallback: TaskState = {
      ...initial,
      status: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
      completedAt: new Date().toISOString(),
    };
    return fallback;
  }
}

/** Resume a previously-started task from its latest checkpoint. */
export async function resumeTask(threadId: string): Promise<TaskState> {
  const graph = getGraph();
  const checkpointer = getCheckpointer();
  logger.info('GraphExecutor', `↻ resume thread=${threadId}`);
  const finalState = await graph.resume(threadId, checkpointer, { threadId, checkpointer });
  logger.info('GraphExecutor', `✓ resumed thread=${threadId} status=${finalState.status}`);
  return finalState;
}

/** Load the latest saved state of a thread (null if unknown). */
export async function getTaskState(threadId: string): Promise<TaskState | null> {
  const latest = await getCheckpointer().loadLatest(threadId);
  return latest?.state ?? null;
}

/** Retrieve the checkpoint history for a thread. */
export async function getTaskHistory(
  threadId: string,
  limit = 100,
): Promise<Array<{ nodeName: string; createdAt: string }>> {
  return getCheckpointer().listHistory(threadId, limit);
}

/** Delete every checkpoint for a thread. */
export async function deleteTaskThread(threadId: string): Promise<void> {
  await getCheckpointer().deleteThread(threadId);
  logger.info('GraphExecutor', `🗑 deleted thread=${threadId}`);
}
