/**
 * INTRACLAW — A/B Prompt Testing
 * Compare two prompt variants on the same task, track which performs better
 */
import * as crypto from 'crypto';
import { getDb } from '../db';
import { ask } from '../ai';
import { logger } from '../utils/logger';

export type ABMetric = 'response_length' | 'llm_score' | 'latency';

export interface ABExperiment {
  id: string;
  name: string;
  taskType: string | null;
  promptA: string;
  promptB: string;
  metric: ABMetric;
  runsA: number;
  runsB: number;
  scoreA: number;
  scoreB: number;
  winner: string | null;
  active: boolean;
  createdAt: string;
}

export interface ABRunResult {
  variant: 'a' | 'b';
  response: string;
  score: number;
  latencyMs: number;
}

function parseExperiment(row: Record<string, unknown>): ABExperiment {
  return {
    id: row.id as string,
    name: row.name as string,
    taskType: row.task_type as string | null,
    promptA: row.prompt_a as string,
    promptB: row.prompt_b as string,
    metric: row.metric as ABMetric,
    runsA: row.runs_a as number,
    runsB: row.runs_b as number,
    scoreA: row.score_a as number,
    scoreB: row.score_b as number,
    winner: row.winner as string | null,
    active: !!(row.active),
    createdAt: row.created_at as string,
  };
}

function scoreResponse(response: string, metric: ABMetric): number {
  switch (metric) {
    case 'response_length': return Math.min(response.length / 500, 1); // Normalize to 0-1
    case 'latency': return 0; // Scored separately
    default: return response.trim().length > 0 ? 0.5 : 0;
  }
}

export function createExperiment(
  name: string,
  promptA: string,
  promptB: string,
  options: { taskType?: string; metric?: ABMetric } = {}
): ABExperiment {
  const db = getDb();
  const id = crypto.randomBytes(8).toString('hex');

  db.prepare(`
    INSERT INTO ab_experiments (id, name, task_type, prompt_a, prompt_b, metric)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, options.taskType ?? null, promptA, promptB, options.metric ?? 'response_length');

  logger.info('A/B', `Experiment created: ${name} (${id})`);
  return parseExperiment(db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(id) as Record<string, unknown>);
}

export async function runVariant(experimentId: string, variant: 'a' | 'b', contextPrompt?: string): Promise<ABRunResult> {
  const db = getDb();
  const exp = db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(experimentId) as Record<string, unknown> | undefined;
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);

  const basePrompt = variant === 'a' ? exp.prompt_a as string : exp.prompt_b as string;
  const fullPrompt = contextPrompt ? `${basePrompt}\n\nContext: ${contextPrompt}` : basePrompt;
  const metric = exp.metric as ABMetric;

  const start = Date.now();
  let response = '';
  try {
    const res = await ask({ messages: [{ role: 'user', content: fullPrompt }], modelTier: 'fast' });
    response = res.content;
  } catch (err) {
    response = `ERROR: ${err instanceof Error ? err.message : String(err)}`;
  }
  const latencyMs = Date.now() - start;

  const score = metric === 'latency' ? Math.max(0, 1 - latencyMs / 10000) : scoreResponse(response, metric);

  // Persist result
  const resultId = crypto.randomBytes(8).toString('hex');
  db.prepare(`
    INSERT INTO ab_results (id, experiment_id, variant, prompt, response, score, latency_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(resultId, experimentId, variant, fullPrompt, response.slice(0, 1000), score, latencyMs);

  // Update aggregate scores
  const colRuns = variant === 'a' ? 'runs_a' : 'runs_b';
  const colScore = variant === 'a' ? 'score_a' : 'score_b';
  const current = db.prepare(`SELECT ${colRuns}, ${colScore} FROM ab_experiments WHERE id = ?`).get(experimentId) as Record<string, number>;
  const newRuns = (current[colRuns] ?? 0) + 1;
  const newScore = ((current[colScore] ?? 0) * (current[colRuns] ?? 0) + score) / newRuns;

  db.prepare(`UPDATE ab_experiments SET ${colRuns} = ?, ${colScore} = ? WHERE id = ?`).run(newRuns, newScore, experimentId);

  return { variant, response, score, latencyMs };
}

export async function runBothVariants(experimentId: string, contextPrompt?: string): Promise<{ a: ABRunResult; b: ABRunResult }> {
  const [a, b] = await Promise.all([
    runVariant(experimentId, 'a', contextPrompt),
    runVariant(experimentId, 'b', contextPrompt),
  ]);
  return { a, b };
}

export function concludeExperiment(experimentId: string): { winner: string; experiment: ABExperiment } {
  const db = getDb();
  const exp = db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(experimentId) as Record<string, unknown> | undefined;
  if (!exp) throw new Error(`Experiment ${experimentId} not found`);

  const scoreA = exp.score_a as number;
  const scoreB = exp.score_b as number;
  const winner = scoreA >= scoreB ? 'a' : 'b';

  db.prepare('UPDATE ab_experiments SET winner = ?, active = 0 WHERE id = ?').run(winner, experimentId);
  logger.info('A/B', `Experiment concluded: ${exp.name as string} — winner: ${winner} (${winner === 'a' ? scoreA.toFixed(3) : scoreB.toFixed(3)} vs ${winner === 'a' ? scoreB.toFixed(3) : scoreA.toFixed(3)})`);

  return {
    winner,
    experiment: parseExperiment(db.prepare('SELECT * FROM ab_experiments WHERE id = ?').get(experimentId) as Record<string, unknown>),
  };
}

export function listExperiments(activeOnly = false): ABExperiment[] {
  const db = getDb();
  const rows = activeOnly
    ? db.prepare('SELECT * FROM ab_experiments WHERE active = 1 ORDER BY created_at DESC').all()
    : db.prepare('SELECT * FROM ab_experiments ORDER BY created_at DESC').all();
  return (rows as Record<string, unknown>[]).map(parseExperiment);
}

export function getExperimentResults(experimentId: string): Record<string, unknown>[] {
  return getDb().prepare(
    'SELECT * FROM ab_results WHERE experiment_id = ? ORDER BY created_at DESC LIMIT 100'
  ).all(experimentId) as Record<string, unknown>[];
}
