/**
 * MODULE 3 — Auto-amélioration du code
 *
 * Analyse les logs récents et les résultats des agents pour détecter
 * des patterns d'erreur ou d'inefficacité, propose des améliorations de code,
 * et applique les modifications UNIQUEMENT après approbation explicite d'Ayman.
 *
 * Flux :
 *   1. analyzeAndPropose()  → lit logs + DB, génère des propositions
 *   2. Ayman valide via Telegram /approve <id> ou dashboard
 *   3. applyProposal(id)    → applique le patch si approuvé
 *
 * Règles invariantes :
 *   - Jamais d'auto-application : toujours approbation avant écriture
 *   - Jamais de modification de .env, Keychain, ou OS
 *   - Toujours backup avant patch
 *   - Les diffs sont visibles avant approbation
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { getDb, getRecentActions, insertNotification } from '../db';
import { AgentTask } from '../types';
import type { AgentResult } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

const PROPOSALS_PATH = path.resolve(process.cwd(), 'data', 'improvement-proposals.json');
const BACKUPS_DIR    = path.resolve(process.cwd(), 'data', 'code-backups');

const PROTECTED_FILES = [
  '.env', '.env.local', '.env.production',
  'package.json', 'package-lock.json', 'tsconfig.json',
  'src/index.ts', // entry point — too risky to auto-patch
];

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';

export interface CodeProposal {
  id: string;
  createdAt: string;
  status: ProposalStatus;
  title: string;
  reasoning: string;
  targetFile: string;         // relative to project root
  originalCode: string;
  proposedCode: string;
  diff?: string;
  approvedAt?: string;
  appliedAt?: string;
  rejectionReason?: string;
}

interface ProposalStore {
  proposals: CodeProposal[];
  lastAnalysis: string;
  totalApplied: number;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadProposals(): ProposalStore {
  try {
    if (fs.existsSync(PROPOSALS_PATH)) {
      return JSON.parse(fs.readFileSync(PROPOSALS_PATH, 'utf8')) as ProposalStore;
    }
  } catch { /* silent */ }
  return { proposals: [], lastAnalysis: '', totalApplied: 0 };
}

function saveProposals(store: ProposalStore): void {
  try {
    const dir = path.dirname(PROPOSALS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROPOSALS_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    logger.warn('SelfImprovement', 'Failed to save proposals', err);
  }
}

function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

// ─── Analysis helpers ─────────────────────────────────────────────────────────

interface ErrorPattern {
  agent: string;
  task: string;
  error: string;
  occurrences: number;
}

function extractErrorPatterns(limit = 100): ErrorPattern[] {
  try {
    const actions = getRecentActions(limit);
    const errors = actions.filter(a => a.status === 'error' && a.error);

    // Group by agent+task+error
    const groups = new Map<string, ErrorPattern>();
    for (const a of errors) {
      const key = `${a.agent}|${a.task}|${a.error?.slice(0, 80)}`;
      if (groups.has(key)) {
        groups.get(key)!.occurrences++;
      } else {
        groups.set(key, {
          agent: a.agent,
          task: a.task,
          error: a.error ?? '',
          occurrences: 1,
        });
      }
    }

    return Array.from(groups.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5); // top 5 recurring errors
  } catch {
    return [];
  }
}

function getSuccessRate(): { total: number; successes: number; rate: number } {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes
      FROM agent_actions
      WHERE created_at > datetime('now', '-7 days')
    `).get() as { total: number; successes: number };

    const rate = row.total > 0 ? (row.successes / row.total) * 100 : 100;
    return { ...row, rate };
  } catch {
    return { total: 0, successes: 0, rate: 100 };
  }
}

// ─── Diff generation (simple line-based) ─────────────────────────────────────

function generateDiff(original: string, proposed: string, filename: string): string {
  const origLines = original.split('\n');
  const propLines = proposed.split('\n');
  const lines: string[] = [`--- a/${filename}`, `+++ b/${filename}`];

  // Very simple diff — show changed lines
  const maxLen = Math.max(origLines.length, propLines.length);
  let changeBlock: string[] = [];

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i];
    const p = propLines[i];

    if (o !== p) {
      if (o !== undefined) changeBlock.push(`- ${o}`);
      if (p !== undefined) changeBlock.push(`+ ${p}`);
    } else {
      if (changeBlock.length > 0) {
        lines.push(...changeBlock);
        changeBlock = [];
      }
    }
  }

  if (changeBlock.length > 0) lines.push(...changeBlock);
  return lines.join('\n');
}

// ─── Core: analyze and propose ───────────────────────────────────────────────

/**
 * Analyzes recent errors and slow tasks, then proposes targeted code improvements.
 * Does NOT apply anything — returns proposals for user approval.
 */
export async function analyzeAndPropose(): Promise<AgentResult> {
  const start = Date.now();
  logger.info('SelfImprovement', 'Starting analysis...');

  const store = loadProposals();
  const errorPatterns = extractErrorPatterns(200);
  const stats = getSuccessRate();

  const prompt = `
Tu es l'agent d'auto-amélioration d'IntraClaw. Tu analyses les erreurs récentes et proposes des corrections de code précises.

STATISTIQUES 7 DERNIERS JOURS :
- Total actions : ${stats.total}
- Succès : ${stats.successes} (${stats.rate.toFixed(1)}%)

ERREURS RÉCURRENTES (top 5) :
${errorPatterns.length === 0
    ? '- Aucune erreur récurrente détectée ✅'
    : errorPatterns.map((e, i) =>
        `${i + 1}. Agent: ${e.agent} | Tâche: ${e.task} | Erreur: "${e.error}" | Occurrences: ${e.occurrences}`
      ).join('\n')
  }

PROPOSITIONS DÉJÀ EN ATTENTE : ${store.proposals.filter(p => p.status === 'pending').length}
DÉJÀ APPLIQUÉES : ${store.totalApplied}

INSTRUCTION :
Si tu vois des patterns d'erreur clairs avec une cause probable, propose UNE correction de code ciblée.
Si tout va bien (taux succès > 90%, peu d'erreurs), réponds avec proposals=[].

Réponds en JSON strict :
{
  "analysis": "courte analyse en 1-2 phrases",
  "proposals": [
    {
      "title": "titre court de l'amélioration",
      "reasoning": "pourquoi ce changement réduit l'erreur",
      "targetFile": "src/agents/prospection.ts",
      "targetFunction": "nom de la fonction à modifier (optionnel)",
      "change": "description précise du changement (pas de code, juste ce qui doit changer)"
    }
  ]
}

Limite : max 2 propositions par analyse. Sois conservateur — propose seulement si tu es certain.
`.trim();

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   600,
      temperature: 0.2,
      task: AgentTask.MAINTENANCE,
    });

    const match = response.content.match(/\{[\s\S]*"analysis"[\s\S]*\}/);
    if (!match) {
      logger.info('SelfImprovement', 'No proposals from analysis');
      store.lastAnalysis = new Date().toISOString();
      saveProposals(store);
      return {
        task: AgentTask.MAINTENANCE,
        success: true,
        data: { proposals: 0, analysis: 'No JSON in response' },
        durationMs: Date.now() - start,
        model: response.model,
        timestamp: new Date().toISOString(),
      };
    }

    const parsed = JSON.parse(match[0]) as {
      analysis: string;
      proposals: Array<{
        title: string;
        reasoning: string;
        targetFile: string;
        targetFunction?: string;
        change: string;
      }>;
    };

    logger.info('SelfImprovement', `Analysis: ${parsed.analysis}`);
    logger.info('SelfImprovement', `${parsed.proposals.length} proposal(s) generated`);

    // For each proposal, try to read the target file and generate actual code diff
    const newProposals: CodeProposal[] = [];
    for (const p of parsed.proposals) {
      const absPath = path.resolve(process.cwd(), p.targetFile);

      // Safety: skip protected files
      const rel = path.relative(process.cwd(), absPath);
      if (PROTECTED_FILES.some(pf => rel === pf || rel.endsWith(pf))) {
        logger.warn('SelfImprovement', `Skipping protected file: ${p.targetFile}`);
        continue;
      }

      if (!fs.existsSync(absPath)) {
        logger.warn('SelfImprovement', `Target file not found: ${p.targetFile}`);
        continue;
      }

      const originalCode = fs.readFileSync(absPath, 'utf8');

      // Ask Claude to generate the actual code patch
      const patchPrompt = `
Voici le fichier TypeScript \`${p.targetFile}\` complet :

\`\`\`typescript
${originalCode.slice(0, 6000)} ${originalCode.length > 6000 ? '\n... (tronqué)' : ''}
\`\`\`

Changement demandé : ${p.change}
${p.targetFunction ? `Fonction cible : ${p.targetFunction}` : ''}

Génère le fichier complet modifié. Réponds UNIQUEMENT avec le code TypeScript complet, sans balises markdown, sans explications.
`.trim();

      const patchResponse = await ask({
        messages: [
          { role: 'system', content: 'Tu es un expert TypeScript. Tu génères des patches de code précis et minimaux.' },
          { role: 'user',   content: patchPrompt },
        ],
        maxTokens:   2000,
        temperature: 0.1,
        task: AgentTask.MAINTENANCE,
      });

      // Strip possible markdown fences
      const proposedCode = patchResponse.content
        .replace(/^```(?:typescript|ts)?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();

      if (proposedCode === originalCode.trim()) {
        logger.info('SelfImprovement', `No actual change generated for ${p.targetFile}`);
        continue;
      }

      const proposal: CodeProposal = {
        id:           `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt:    new Date().toISOString(),
        status:       'pending',
        title:        p.title,
        reasoning:    p.reasoning,
        targetFile:   p.targetFile,
        originalCode,
        proposedCode,
        diff:         generateDiff(originalCode, proposedCode, p.targetFile),
      };

      newProposals.push(proposal);
      store.proposals.push(proposal);

      insertNotification(
        'info',
        `Proposition d'amélioration : ${p.title} (${p.targetFile}) — en attente d'approbation`
      );
    }

    store.lastAnalysis = new Date().toISOString();
    saveProposals(store);

    return {
      task: AgentTask.MAINTENANCE,
      success: true,
      data: {
        analysis:  parsed.analysis,
        proposals: newProposals.length,
        ids:       newProposals.map(p => p.id),
      },
      durationMs: Date.now() - start,
      model:      response.model,
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('SelfImprovement', 'Analysis failed', error);
    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}

// ─── Apply proposal (after user approval) ────────────────────────────────────

/**
 * Apply a previously approved code proposal.
 * Creates a backup before writing.
 * REQUIRES status === 'approved'.
 */
export async function applyProposal(proposalId: string): Promise<AgentResult> {
  const store = loadProposals();
  const proposal = store.proposals.find(p => p.id === proposalId);

  if (!proposal) {
    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error: `Proposal ${proposalId} not found`,
      durationMs: 0,
      model: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  if (proposal.status !== 'approved') {
    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error: `Proposal ${proposalId} is not approved (status: ${proposal.status}). Cannot apply.`,
      durationMs: 0,
      model: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  const absPath = path.resolve(process.cwd(), proposal.targetFile);

  // Safety check — re-verify protected files at apply time
  const rel = path.relative(process.cwd(), absPath);
  if (PROTECTED_FILES.some(pf => rel === pf || rel.endsWith(pf))) {
    proposal.status = 'failed';
    saveProposals(store);
    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error: `Cannot apply to protected file: ${proposal.targetFile}`,
      durationMs: 0,
      model: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  const start = Date.now();

  try {
    ensureBackupsDir();

    // Backup original
    const backupName = `${rel.replace(/\//g, '__')}.${Date.now()}.bak`;
    const backupPath = path.join(BACKUPS_DIR, backupName);
    fs.copyFileSync(absPath, backupPath);
    logger.info('SelfImprovement', `Backup created: ${backupPath}`);

    // Write proposed code
    fs.writeFileSync(absPath, proposal.proposedCode, 'utf8');
    logger.info('SelfImprovement', `Applied proposal ${proposalId} to ${proposal.targetFile}`);

    // Update state
    proposal.status    = 'applied';
    proposal.appliedAt = new Date().toISOString();
    store.totalApplied++;
    saveProposals(store);

    insertNotification(
      'info',
      `Amélioration appliquée : "${proposal.title}" → ${proposal.targetFile}`
    );

    return {
      task: AgentTask.MAINTENANCE,
      success: true,
      data: {
        proposalId,
        file:   proposal.targetFile,
        backup: backupPath,
      },
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('SelfImprovement', `Apply failed for ${proposalId}`, error);

    proposal.status = 'failed';
    saveProposals(store);

    return {
      task: AgentTask.MAINTENANCE,
      success: false,
      error,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}

// ─── Approve / reject ─────────────────────────────────────────────────────────

export function approveProposal(id: string): void {
  const store = loadProposals();
  const p = store.proposals.find(x => x.id === id);
  if (p && p.status === 'pending') {
    p.status     = 'approved';
    p.approvedAt = new Date().toISOString();
    saveProposals(store);
    logger.info('SelfImprovement', `Proposal ${id} approved`);
  }
}

export function rejectProposal(id: string, reason = ''): void {
  const store = loadProposals();
  const p = store.proposals.find(x => x.id === id);
  if (p && p.status === 'pending') {
    p.status           = 'rejected';
    p.rejectionReason  = reason;
    saveProposals(store);
    logger.info('SelfImprovement', `Proposal ${id} rejected: ${reason}`);
  }
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export function getPendingProposals(): CodeProposal[] {
  return loadProposals().proposals.filter(p => p.status === 'pending');
}

export function getProposal(id: string): CodeProposal | undefined {
  return loadProposals().proposals.find(p => p.id === id);
}

export function getImprovementStats(): {
  pending: number;
  approved: number;
  applied: number;
  rejected: number;
  total: number;
  lastAnalysis: string;
} {
  const store = loadProposals();
  return {
    pending:      store.proposals.filter(p => p.status === 'pending').length,
    approved:     store.proposals.filter(p => p.status === 'approved').length,
    applied:      store.proposals.filter(p => p.status === 'applied').length,
    rejected:     store.proposals.filter(p => p.status === 'rejected').length,
    total:        store.proposals.length,
    lastAnalysis: store.lastAnalysis,
  };
}
