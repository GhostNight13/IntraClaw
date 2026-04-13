/**
 * Observation Recorder
 *
 * Enregistre chaque observation après une action de la boucle autonome :
 *   - Log dans SQLite via insertAction
 *   - Extraction de faits appris → addLearnedFact
 */

import { insertAction } from '../db';
import { addLearnedFact } from '../memory/enhanced';
import { storeMemory, isVectorMemoryAvailable } from '../memory/vector-memory';
import { logger } from '../utils/logger';
import type { AgentResult, LoopAction } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Observation {
  action: LoopAction;
  result: AgentResult | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

// ─── Fact extraction ─────────────────────────────────────────────────────────

function extractFacts(obs: Observation): string[] {
  const { action, result } = obs;
  if (!result?.success || !result.data) return [];

  const date = new Date(obs.finishedAt).toISOString().slice(0, 10);
  const data = result.data as Record<string, unknown>;
  const facts: string[] = [];

  if (action.type === 'prospecting') {
    const count = Number(data.prospectsAdded ?? 0);
    if (count > 0) {
      facts.push(`[${date}] Prospection: ${count} nouveaux prospects ajoutés au CRM Notion`);
    }
  }

  if (action.type === 'cold_email') {
    const count = Number(data.emailsSent ?? 0);
    if (count > 0) {
      facts.push(`[${date}] Cold email: ${count} emails envoyés via Gmail`);
    }
  }

  if (action.type === 'content') {
    const topic = data.topic;
    if (typeof topic === 'string' && topic.length > 0) {
      facts.push(`[${date}] LinkedIn post créé sur le topic: ${topic}`);
    }
  }

  return facts;
}

// ─── Category mapping ────────────────────────────────────────────────────────

function categoryForAction(type: LoopAction['type']): 'prospect' | 'metric' | 'context' {
  switch (type) {
    case 'prospecting':
    case 'cold_email':
      return 'prospect';
    case 'content':
    case 'morning_brief':
    case 'evening_report':
      return 'metric';
    default:
      return 'context';
  }
}

// ─── Main recorder ──────────────────────────────────────────────────────────

export async function recordObservation(obs: Observation): Promise<void> {
  const { action, result } = obs;
  const status = result?.success ? 'success' : 'error';
  const icon = result?.success ? '✅' : '❌';

  // 1. Persist to SQLite
  try {
    insertAction({
      agent: 'loop',
      task: action.type,
      status,
      duration_ms: obs.durationMs,
      model: result?.model ?? 'none',
      cost_eur: result?.costEur ?? 0,
      error: result?.error,
    });
  } catch (err) {
    logger.error('ObservationRecorder', 'insertAction failed', err instanceof Error ? err.message : err);
  }

  // 2. Extract and store learned facts
  const facts = extractFacts(obs);
  const category = categoryForAction(action.type);
  const source = `loop/${action.type}`;

  for (const fact of facts) {
    try {
      addLearnedFact(category, fact, source);
    } catch (err) {
      logger.error('ObservationRecorder', 'addLearnedFact failed', err instanceof Error ? err.message : err);
    }
  }

  // 3. Store in vector memory if available
  if (isVectorMemoryAvailable() && result?.success) {
    await storeMemory({
      content: `${action.type}: ${action.reason}. Durée: ${obs.durationMs}ms.`,
      category: 'action',
      source: action.type,
      metadata: { success: true, durationMs: obs.durationMs },
    }).catch(() => {});
  }

  // 4. Summary log
  const factsSuffix = facts.length > 0 ? ` | ${facts.length} fait(s) appris` : '';
  logger.info(
    'ObservationRecorder',
    `${icon} ${action.type} (${obs.durationMs}ms) — ${status}${factsSuffix}`,
  );
}
