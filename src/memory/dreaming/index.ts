/**
 * INTRACLAW -- REM Cycle Orchestrator
 * Lance chaque nuit a 3h du matin par le cron de l'autonomous-loop
 */
import type { REMReport, Pattern } from './types';
import { consolidateActions } from './consolidator';
import { minePatterns } from './pattern-miner';
import { compressOldMemories } from './memory-compressor';
import { writeInsightsToHeartbeat } from './insight-writer';
import { getRecentActions } from '../../db';
import { logger } from '../../utils/logger';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: '\u{1F4A4}', warn: '\u26A0\uFE0F', error: '\u274C' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [REM] ${msg}`);
}

export async function runREMCycle(): Promise<REMReport> {
  log('info', '=== \u{1F4A4} DEMARRAGE DU CYCLE REM NOCTURNE ===');
  const startedAt = new Date().toISOString();
  const startMs   = Date.now();

  let actionsReviewed = 0;
  let memoriesCompressed = 0;
  let patterns: Pattern[] = [];
  let review = 'Aucune action recente.';
  let heartbeatUpdated = false;
  const insightsGenerated: string[] = [];

  try {
    // 1. Recupere les actions des dernieres 24h
    const actions = getRecentActions(24 * 60);  // 24h en minutes
    actionsReviewed = actions.length;
    log('info', `${actionsReviewed} actions a analyser`);

    // 2. Consolidation (resume des 24h)
    if (actionsReviewed > 0) {
      review = await consolidateActions(actions);
      insightsGenerated.push(review);
      log('info', 'Consolidation terminee');
    }

    // 3. Pattern Mining
    if (actionsReviewed >= 3) {
      patterns = await minePatterns(actions);
      for (const p of patterns) {
        if (p.actionable && p.suggestion) {
          insightsGenerated.push(`[${p.category}] ${p.suggestion}`);
        }
      }
      log('info', `${patterns.length} patterns trouves`);
    }

    // 4. Compression memoire ancienne (> 7 jours)
    memoriesCompressed = await compressOldMemories(7);
    log('info', `${memoriesCompressed} souvenirs compresses`);

    // 5. Ecriture HEARTBEAT.md
    heartbeatUpdated = writeInsightsToHeartbeat({ review, patterns });

    // 6. Business Memory update
    try {
      const { recordBusinessLearning } = require('../business-memory');
      for (const p of patterns.filter((p: Pattern) => p.confidence > 0.6)) {
        await recordBusinessLearning({
          insight:    p.description,
          source:     'rem_cycle',
          confidence: p.confidence,
        });
      }
      log('info', 'Business memory enrichie');
    } catch {
      // business-memory peut ne pas etre disponible
    }

  } catch (err: any) {
    log('error', `Erreur pendant le cycle REM: ${err.message}`);
  }

  const durationMs = Date.now() - startMs;
  log('info', `=== \u{1F4A4} CYCLE REM TERMINE en ${(durationMs / 1000).toFixed(1)}s ===`);

  return {
    date:               new Date().toISOString().split('T')[0],
    startedAt,
    completedAt:        new Date().toISOString(),
    durationMs,
    actionsReviewed,
    patternsFound:      patterns,
    memoriesCompressed,
    insightsGenerated,
    heartbeatUpdated,
  };
}
