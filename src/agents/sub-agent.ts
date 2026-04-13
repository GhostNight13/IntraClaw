// src/agents/sub-agent.ts
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { logger } from '../utils/logger';
import type { ModelTier } from '../types';
import { AgentTask } from '../types';

const MAX_PARALLEL     = 3;      // Max concurrent sub-agents
const MAX_DEPTH        = 2;      // Max delegation depth
const SUBAGENT_TIMEOUT = 120000; // 2 min timeout per sub-agent

export interface SubAgentTask {
  id: string;
  name: string;
  prompt: string;
  modelTier: ModelTier;
}

export interface SubAgentResult {
  taskId: string;
  taskName: string;
  success: boolean;
  content: string;
  durationMs: number;
  error?: string;
}

let _currentDepth = 0;

/**
 * Execute a single sub-agent task.
 */
async function executeSubAgent(task: SubAgentTask, depth: number): Promise<SubAgentResult> {
  const startMs = Date.now();
  logger.info('SubAgent', `[depth=${depth}] Starting: ${task.name}`);

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: task.prompt },
      ],
      maxTokens:   1000,
      temperature: 0.4,
      task:        AgentTask.MORNING_BRIEF,
      modelTier:   task.modelTier,
    });

    return {
      taskId: task.id,
      taskName: task.name,
      success: true,
      content: response.content,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      taskId: task.id,
      taskName: task.name,
      success: false,
      content: '',
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/**
 * Delegate multiple tasks to sub-agents in parallel.
 * Max 3 concurrent, max depth 2.
 */
export async function delegateTasks(tasks: SubAgentTask[]): Promise<SubAgentResult[]> {
  if (_currentDepth >= MAX_DEPTH) {
    logger.warn('SubAgent', `Max delegation depth reached (${MAX_DEPTH})`);
    return tasks.map(t => ({
      taskId: t.id, taskName: t.name,
      success: false, content: '', durationMs: 0,
      error: `Max delegation depth (${MAX_DEPTH}) reached`,
    }));
  }

  _currentDepth++;
  logger.info('SubAgent', `Delegating ${tasks.length} tasks (depth=${_currentDepth}, max_parallel=${MAX_PARALLEL})`);

  const results: SubAgentResult[] = [];

  // Process in batches of MAX_PARALLEL
  for (let i = 0; i < tasks.length; i += MAX_PARALLEL) {
    const batch = tasks.slice(i, i + MAX_PARALLEL);
    logger.info('SubAgent', `Batch ${Math.floor(i / MAX_PARALLEL) + 1}: ${batch.map(t => t.name).join(', ')}`);

    const batchResults = await Promise.allSettled(
      batch.map(task =>
        Promise.race([
          executeSubAgent(task, _currentDepth),
          new Promise<SubAgentResult>((_, reject) =>
            setTimeout(() => reject(new Error('Sub-agent timeout')), SUBAGENT_TIMEOUT)
          ),
        ])
      )
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          taskId: batch[j].id,
          taskName: batch[j].name,
          success: false,
          content: '',
          durationMs: SUBAGENT_TIMEOUT,
          error: result.reason?.message ?? 'Sub-agent failed',
        });
      }
    }
  }

  _currentDepth--;

  const successes = results.filter(r => r.success).length;
  logger.info('SubAgent', `Delegation complete: ${successes}/${results.length} succeeded`);
  return results;
}

/**
 * Aggregate results from multiple sub-agents into a summary.
 */
export async function delegateAndSummarize(
  tasks: SubAgentTask[],
  summaryPrompt: string
): Promise<{ results: SubAgentResult[]; summary: string }> {
  const results = await delegateTasks(tasks);

  const context = results.map(r =>
    `### ${r.taskName} (${r.success ? 'OK' : 'FAIL'})\n${r.success ? r.content : `Error: ${r.error}`}`
  ).join('\n\n');

  const summary = await ask({
    messages: [
      { role: 'system', content: 'Tu es un agent de synthese. Resume les resultats des sous-agents.' },
      { role: 'user',   content: `${summaryPrompt}\n\nRESULTATS DES SOUS-AGENTS :\n\n${context}` },
    ],
    maxTokens:   500,
    temperature: 0.3,
    task:        AgentTask.MORNING_BRIEF,
    modelTier:   'fast',
  });

  return { results, summary: summary.content };
}
