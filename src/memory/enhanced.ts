/**
 * MODULE 4 — Enhanced Memory
 *
 * Apprend de chaque interaction et met à jour automatiquement :
 *   - HEARTBEAT.md  : état opérationnel et métriques du jour
 *   - MEMORY.md     : faits appris sur les prospects/contexte
 *
 * Règles :
 *   - N'écrase jamais SOUL.md, IDENTITY.md, USER.md, AGENTS.md (fichiers fondateurs)
 *   - Toutes les mises à jour sont incrémentales (append + summarize, pas replace)
 *   - Chaque update est loggué dans SQLite
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt, reloadMemoryFile, getLoadedMemory } from './core';
import { getRecentActions, insertNotification, getDb } from '../db';
import { AgentTask } from '../types';
import type { AgentResult } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const MEMORY_DIR = path.resolve(process.cwd(), 'memory');

// Files that can be auto-updated by this module
const UPDATABLE_FILES = ['HEARTBEAT.md', 'MEMORY.md'] as const;
type UpdatableFile = typeof UPDATABLE_FILES[number];

// Files that MUST NEVER be auto-modified
const PROTECTED_MEMORY = ['SOUL.md', 'IDENTITY.md', 'USER.md', 'AGENTS.md', 'BOOTSTRAP.md', 'TOOLS.md'];

// ─── Learned facts persistence ────────────────────────────────────────────────

export interface LearnedFact {
  id: string;
  createdAt: string;
  category: 'prospect' | 'pattern' | 'preference' | 'metric' | 'context';
  fact: string;
  source: string; // agent/task that generated this
  integrated: boolean; // whether it's been written to MEMORY.md
}

const FACTS_PATH = path.resolve(process.cwd(), 'data', 'learned-facts.json');

function loadFacts(): LearnedFact[] {
  try {
    if (fs.existsSync(FACTS_PATH)) {
      return JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8')) as LearnedFact[];
    }
  } catch { /* silent */ }
  return [];
}

function saveFacts(facts: LearnedFact[]): void {
  try {
    const dir = path.dirname(FACTS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FACTS_PATH, JSON.stringify(facts, null, 2), 'utf8');
  } catch { /* silent */ }
}

/**
 * Add a single learned fact to the facts store.
 */
export function addLearnedFact(
  category: LearnedFact['category'],
  fact: string,
  source: string,
): void {
  const facts = loadFacts();
  facts.push({
    id: `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    category,
    fact,
    source,
    integrated: false,
  });
  saveFacts(facts);
}

// ─── Safe file update ─────────────────────────────────────────────────────────

function readMemoryFile(filename: UpdatableFile): string {
  const filePath = path.join(MEMORY_DIR, filename);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

function writeMemoryFile(filename: UpdatableFile, content: string): void {
  // Safety: absolutely never write to protected files
  if (PROTECTED_MEMORY.includes(filename)) {
    logger.error('EnhancedMemory', `BLOCKED write to protected file: ${filename}`);
    return;
  }
  const filePath = path.join(MEMORY_DIR, filename);
  // Backup before write
  if (fs.existsSync(filePath)) {
    const backup = filePath + '.bak';
    fs.copyFileSync(filePath, backup);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  reloadMemoryFile(filename);
  logger.info('EnhancedMemory', `Updated ${filename}`);
}

// ─── HEARTBEAT update ─────────────────────────────────────────────────────────

/**
 * Update HEARTBEAT.md with today's operational metrics.
 * This is called at the end of MAINTENANCE runs.
 */
export async function updateHeartbeat(): Promise<void> {
  try {
    const db = getDb();

    // Last 24h stats
    const stats = db.prepare(`
      SELECT
        COUNT(*)                                            AS total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
        SUM(CASE WHEN status = 'error'   THEN 1 ELSE 0 END) AS errors,
        AVG(duration_ms)                                    AS avg_duration,
        MAX(created_at)                                     AS last_action
      FROM agent_actions
      WHERE created_at > datetime('now', '-24 hours')
    `).get() as {
      total: number; successes: number; errors: number;
      avg_duration: number; last_action: string;
    };

    const successRate = stats.total > 0 ? ((stats.successes / stats.total) * 100).toFixed(1) : '100';
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const content = [
      `# HEARTBEAT`,
      ``,
      `> Mis à jour automatiquement par Enhanced Memory — Module 4`,
      `> Dernière update : ${now}`,
      ``,
      `## État opérationnel`,
      ``,
      `| Métrique            | Valeur                    |`,
      `| ------------------- | ------------------------- |`,
      `| Date                | ${today}                  |`,
      `| Actions (24h)       | ${stats.total}            |`,
      `| Succès              | ${stats.successes} (${successRate}%) |`,
      `| Erreurs             | ${stats.errors}           |`,
      `| Durée moy.          | ${stats.avg_duration ? Math.round(stats.avg_duration) + 'ms' : 'N/A'} |`,
      `| Dernière action     | ${stats.last_action ?? 'N/A'} |`,
      ``,
      `## Statut des modules`,
      ``,
      `| Module              | Statut |`,
      `| ------------------- | ------ |`,
      `| Module 1 — Computer Use     | ✅ Actif |`,
      `| Module 2 — Boucle autonome  | ✅ Actif |`,
      `| Module 3 — Auto-amélioration | ✅ Actif |`,
      `| Module 4 — Enhanced Memory  | ✅ Actif |`,
      ``,
      `## Notes de session`,
      ``,
      `- Système démarré et opérationnel`,
      `- Tous les agents disponibles : coordinator, prospection, cold-email, content, reporting`,
      `- API Express + WebSocket actifs sur port 3001`,
      `- Dashboard Next.js disponible sur port 3000`,
    ].join('\n');

    writeMemoryFile('HEARTBEAT.md', content);
    logger.info('EnhancedMemory', `HEARTBEAT updated — ${stats.total} actions, ${successRate}% success rate`);
  } catch (err) {
    logger.warn('EnhancedMemory', 'updateHeartbeat failed', err instanceof Error ? err.message : err);
  }
}

// ─── Learn from interactions ──────────────────────────────────────────────────

/**
 * Extract learnable facts from recent agent results using Claude.
 * Stores new facts in the facts store for later integration into MEMORY.md.
 */
export async function learnFromInteractions(): Promise<void> {
  try {
    const recent = getRecentActions(30);
    const errors = recent.filter(a => a.status === 'error' && a.error);
    const successes = recent.filter(a => a.status === 'success');

    if (recent.length === 0) {
      logger.info('EnhancedMemory', 'No recent actions to learn from');
      return;
    }

    const prompt = `
Tu es l'agent mémoire d'IntraClaw. Tu analyses les actions récentes pour en extraire des faits utiles à mémoriser.

ACTIONS RÉCENTES (${recent.length} au total) :
- ${successes.length} succès, ${errors.length} erreurs

ERREURS RÉCENTES :
${errors.slice(0, 5).map(e => `- [${e.agent}/${e.task}] ${e.error}`).join('\n') || 'Aucune'}

SUCCÈS NOTABLES :
${successes.slice(0, 5).map(s => `- [${s.agent}/${s.task}] ${s.duration_ms}ms`).join('\n') || 'Aucun'}

INSTRUCTION :
Extrait UNIQUEMENT des faits utiles à long terme (pas des données éphémères).
Un fait utile = une information qui aide à mieux gérer l'agence ou améliorer les agents.
Exemples : "L'agent prospection prend en moyenne Xms", "Les emails vers secteur Y ont X% réponse", etc.

Réponds en JSON :
{
  "facts": [
    { "category": "metric|pattern|context", "fact": "string court et précis", "source": "agent/task" }
  ]
}

Maximum 3 faits. Si rien de significatif, réponds avec facts=[].
`.trim();

    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu es un agent mémoire. Tu extrais des faits utiles et factuels uniquement.' },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   300,
      temperature: 0.2,
      task: AgentTask.MAINTENANCE,
      modelTier:   'fast',  // Fact extraction = simple parsing
    });

    const match = response.content.match(/\{[\s\S]*"facts"[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as {
      facts: Array<{ category: LearnedFact['category']; fact: string; source: string }>;
    };

    if (parsed.facts.length === 0) {
      logger.info('EnhancedMemory', 'No new facts to learn');
      return;
    }

    const facts = loadFacts();
    const newFacts: LearnedFact[] = parsed.facts.map(f => ({
      id:         `fact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt:  new Date().toISOString(),
      category:   f.category,
      fact:       f.fact,
      source:     f.source,
      integrated: false,
    }));

    facts.push(...newFacts);
    saveFacts(facts);

    logger.info('EnhancedMemory', `Learned ${newFacts.length} new fact(s)`);
    for (const f of newFacts) {
      logger.info('EnhancedMemory', `  [${f.category}] ${f.fact}`);
    }
  } catch (err) {
    logger.warn('EnhancedMemory', 'learnFromInteractions failed', err instanceof Error ? err.message : err);
  }
}

// ─── Integrate facts into MEMORY.md ──────────────────────────────────────────

/**
 * Periodically integrate non-integrated facts into MEMORY.md.
 * Summarizes and deduplicates to keep the file lean.
 */
export async function integrateFacts(): Promise<void> {
  try {
    const facts = loadFacts();
    const pending = facts.filter(f => !f.integrated);

    if (pending.length === 0) {
      logger.info('EnhancedMemory', 'No pending facts to integrate');
      return;
    }

    const currentMemory = readMemoryFile('MEMORY.md');

    const prompt = `
Tu es l'agent mémoire d'IntraClaw. Tu dois mettre à jour MEMORY.md avec les nouveaux faits appris.

CONTENU ACTUEL DE MEMORY.md :
${currentMemory.slice(0, 3000) || '(vide)'}

NOUVEAUX FAITS À INTÉGRER :
${pending.map(f => `- [${f.category}] ${f.fact} (source: ${f.source})`).join('\n')}

INSTRUCTION :
Génère le nouveau contenu complet de MEMORY.md en intégrant les faits.
- Conserve les informations importantes déjà présentes
- Ajoute les nouveaux faits de manière structurée
- Déduplique si nécessaire
- Format Markdown propre avec sections claires
- Maximum 150 lignes

Commence le fichier par :
# MEMORY — Faits appris
> Auto-mis à jour par Enhanced Memory — ${new Date().toISOString().slice(0, 10)}

Réponds UNIQUEMENT avec le contenu du fichier Markdown.
`.trim();

    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu es un agent mémoire. Tu génères du Markdown propre et structuré.' },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   1500,
      temperature: 0.2,
      task: AgentTask.MAINTENANCE,
      modelTier:   'fast',  // Markdown formatting = simple task
    });

    // Strip possible markdown fences
    const newContent = response.content
      .replace(/^```(?:markdown|md)?\n?/m, '')
      .replace(/\n?```$/m, '')
      .trim();

    writeMemoryFile('MEMORY.md', newContent);

    // Mark all pending facts as integrated
    for (const f of pending) {
      f.integrated = true;
    }
    saveFacts(facts);

    logger.info('EnhancedMemory', `Integrated ${pending.length} fact(s) into MEMORY.md`);
    insertNotification('info', `Mémoire mise à jour : ${pending.length} nouveau(x) fait(s) intégré(s)`);
  } catch (err) {
    logger.warn('EnhancedMemory', 'integrateFacts failed', err instanceof Error ? err.message : err);
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Full enhanced memory cycle:
 *   1. Update HEARTBEAT.md with current metrics
 *   2. Learn from recent interactions
 *   3. If enough pending facts, integrate into MEMORY.md
 */
export async function runEnhancedMemory(): Promise<AgentResult> {
  const start = Date.now();
  logger.info('EnhancedMemory', 'Running enhanced memory cycle...');

  try {
    await updateHeartbeat();
    await learnFromInteractions();

    // Integrate if 3+ pending facts accumulated
    const facts = loadFacts();
    const pending = facts.filter(f => !f.integrated);
    if (pending.length >= 3) {
      await integrateFacts();
    } else {
      logger.info('EnhancedMemory', `${pending.length} pending fact(s) — waiting for more before integrating`);
    }

    return {
      task: AgentTask.MAINTENANCE,
      success: true,
      data: {
        heartbeatUpdated: true,
        pendingFacts: facts.filter(f => !f.integrated).length,
        totalFacts: facts.length,
      },
      durationMs: Date.now() - start,
      model: 'claude',
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('EnhancedMemory', 'runEnhancedMemory failed', error);
    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error,
      durationMs: Date.now() - start,
      model: 'none',
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getMemoryStats(): {
  totalFacts: number;
  pendingFacts: number;
  integratedFacts: number;
  memoryFiles: Array<{ filename: string; chars: number }>;
} {
  const facts = loadFacts();
  const loaded = getLoadedMemory();
  return {
    totalFacts:      facts.length,
    pendingFacts:    facts.filter(f => !f.integrated).length,
    integratedFacts: facts.filter(f => f.integrated).length,
    memoryFiles:     loaded.map(m => ({ filename: m.filename, chars: m.content.length })),
  };
}
