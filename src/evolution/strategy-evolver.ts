import * as fs from 'fs';
import * as path from 'path';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { getActions } from '../db';
import { AgentTask } from '../types';
import { logger } from '../utils/logger';

const STRATEGY_PATH = path.resolve(process.cwd(), 'data', 'strategy.json');
const LINEAGE_PATH  = path.resolve(process.cwd(), 'data', 'strategy-lineage.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessMetrics {
  period: string;                // "2026-W16"
  prospectsScraped: number;
  emailsSent: number;
  repliesReceived: number;
  demosBooked: number;
  conversions: number;
  responseRate: number;          // %
  conversionRate: number;        // %
  topPerformingSector: string;
  topPerformingLanguage: string; // 'fr' | 'nl'
  topEmailTone: string;
  totalActions: number;
  failureRate: number;           // %
}

interface StrategyGeneration {
  generation: number;
  createdAt: string;
  strategy: {
    focusSectors: string[];        // Quels secteurs cibler
    focusRegions: string[];        // Quelles régions
    emailTone: string;             // direct | formel | conversationnel
    primaryLanguage: string;       // fr | nl
    weeklyGoal: string;            // Objectif chiffré
    contentTopics: string[];       // Topics LinkedIn
    priorityAction: string;        // Le levier #1
  };
  metrics: BusinessMetrics | null; // null pour Gen 1
  wonderInsights: string[];        // Ce qu'on a appris
  reflectMutations: string[];      // Ce qu'on a changé
  convergenceScore: number;        // 0-1, 1 = stable
}

interface StrategyLineage {
  currentGeneration: number;
  generations: StrategyGeneration[];
  converged: boolean;
  convergedAt?: string;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadLineage(): StrategyLineage {
  try {
    if (fs.existsSync(LINEAGE_PATH)) {
      return JSON.parse(fs.readFileSync(LINEAGE_PATH, 'utf8')) as StrategyLineage;
    }
  } catch {
    // ignore parse errors — start fresh
  }
  return {
    currentGeneration: 0,
    generations: [],
    converged: false,
  };
}

function saveLineage(lineage: StrategyLineage): void {
  const dir = path.dirname(LINEAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LINEAGE_PATH, JSON.stringify(lineage, null, 2), 'utf8');
}

// ─── Metrics Collection ───────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function collectWeekMetrics(): BusinessMetrics {
  const now = new Date();
  const weekNum = getISOWeek(now);
  const period = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  // Get last 7 days of actions from DB
  const actions = getActions(500);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekActions = actions.filter(a => a.timestamp >= weekAgo);

  const prospectActions = weekActions.filter(a => a.task === 'prospecting' && a.status === 'success');
  const emailActions = weekActions.filter(a => a.task === 'cold_email' && a.status === 'success');

  const totalActions = weekActions.length;
  const failures = weekActions.filter(a => a.status === 'error').length;

  // Estimate counts from action data (simplified — real counts would come from Notion)
  const prospectsScraped = prospectActions.length * 20;  // ~20 per run
  const emailsSent = emailActions.length * 15;           // ~15 per run
  const repliesReceived = 0;  // Would need Notion query
  const demosBooked = 0;
  const conversions = 0;

  const responseRate = emailsSent > 0 ? (repliesReceived / emailsSent) * 100 : 0;
  const conversionRate = repliesReceived > 0 ? (conversions / repliesReceived) * 100 : 0;

  return {
    period,
    prospectsScraped,
    emailsSent,
    repliesReceived,
    demosBooked,
    conversions,
    responseRate,
    conversionRate,
    topPerformingSector: 'unknown',  // Would need detailed Notion analysis
    topPerformingLanguage: 'fr',
    topEmailTone: 'direct',
    totalActions,
    failureRate: totalActions > 0 ? (failures / totalActions) * 100 : 0,
  };
}

// ─── Wonder ───────────────────────────────────────────────────────────────────

async function wonderPhase(metrics: BusinessMetrics, currentStrategy: StrategyGeneration | null): Promise<string[]> {
  const prompt = `Tu es IntraClaw en mode Wonder (analyse Socratique). Examine les métriques business de la semaine.

MÉTRIQUES SEMAINE ${metrics.period} :
- Prospects scrapés : ${metrics.prospectsScraped}
- Emails envoyés : ${metrics.emailsSent}
- Réponses reçues : ${metrics.repliesReceived}
- Taux de réponse : ${metrics.responseRate.toFixed(1)}%
- Taux de conversion : ${metrics.conversionRate.toFixed(1)}%
- Taux d'échec agent : ${metrics.failureRate.toFixed(1)}%
- Secteur performant : ${metrics.topPerformingSector}
- Langue performante : ${metrics.topPerformingLanguage}

${currentStrategy ? `STRATÉGIE ACTUELLE (Gen ${currentStrategy.generation}) :
- Focus secteurs : ${currentStrategy.strategy.focusSectors.join(', ')}
- Focus régions : ${currentStrategy.strategy.focusRegions.join(', ')}
- Ton email : ${currentStrategy.strategy.emailTone}
- Langue : ${currentStrategy.strategy.primaryLanguage}
- Objectif : ${currentStrategy.strategy.weeklyGoal}` : 'Première génération — pas de stratégie précédente.'}

BENCHMARK :
- Taux réponse cold email B2B : 3-8%
- Taux conversion prospect→client : 10-20%

Pose-toi ces questions Socratiques et identifie 3-5 insights :
1. Qu'est-ce qui a FONCTIONNÉ et pourquoi ?
2. Qu'est-ce qui n'a PAS fonctionné et pourquoi ?
3. Qu'est-ce qu'on ne SAIT PAS et qu'on devrait savoir ?
4. Quelle est l'HYPOTHÈSE non-testée la plus importante ?
5. Quel est le LEVIER avec le meilleur ROI ?

JSON uniquement :
{"insights": ["insight 1", "insight 2", "insight 3"]}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      maxTokens: 500,
      temperature: 0.3,
      task: AgentTask.MAINTENANCE,
      modelTier: 'balanced',
    });

    const match = response.content.match(/\{[\s\S]*"insights"[\s\S]*\}/);
    if (!match) return ['Analyse non concluante'];
    const parsed = JSON.parse(match[0]) as { insights: string[] };
    return parsed.insights;
  } catch {
    return ['Wonder phase failed'];
  }
}

// ─── Reflect ──────────────────────────────────────────────────────────────────

async function reflectPhase(
  insights: string[],
  currentStrategy: StrategyGeneration | null,
  metrics: BusinessMetrics,
): Promise<{ mutations: string[]; newStrategy: StrategyGeneration['strategy'] }> {
  const prompt = `Tu es IntraClaw en mode Reflect (mutation stratégique). Basé sur les insights Wonder, propose une NOUVELLE stratégie.

INSIGHTS WONDER :
${insights.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}

MÉTRIQUES : taux réponse ${metrics.responseRate.toFixed(1)}%, ${metrics.emailsSent} emails, ${metrics.prospectsScraped} prospects

${currentStrategy ? `STRATÉGIE ACTUELLE :
${JSON.stringify(currentStrategy.strategy, null, 2)}` : 'Première génération.'}

Propose la nouvelle stratégie EN MUTANT l'actuelle (ou en créant la première). Explique chaque mutation.

JSON :
{
  "mutations": ["Ce qui a changé et pourquoi"],
  "strategy": {
    "focusSectors": ["horeca", "commerce-detail", "sante"],
    "focusRegions": ["Bruxelles", "Anvers", "Liège"],
    "emailTone": "direct|formel|conversationnel",
    "primaryLanguage": "fr|nl",
    "weeklyGoal": "Objectif chiffré concret",
    "contentTopics": ["topic1", "topic2", "topic3"],
    "priorityAction": "Le levier #1 cette semaine"
  }
}`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'Tu es un stratège business. JSON uniquement.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 600,
      temperature: 0.3,
      task: AgentTask.MAINTENANCE,
      modelTier: 'powerful',
    });

    const match = response.content.match(/\{[\s\S]*"mutations"[\s\S]*"strategy"[\s\S]*\}/);
    if (!match) {
      return {
        mutations: ['Reflect parse failed — keeping current strategy'],
        newStrategy: currentStrategy?.strategy ?? getDefaultStrategy(),
      };
    }
    return JSON.parse(match[0]) as { mutations: string[]; newStrategy: StrategyGeneration['strategy'] };
  } catch {
    return {
      mutations: ['Reflect failed'],
      newStrategy: currentStrategy?.strategy ?? getDefaultStrategy(),
    };
  }
}

function getDefaultStrategy(): StrategyGeneration['strategy'] {
  return {
    focusSectors: ['horeca', 'commerce-detail', 'sante', 'immobilier'],
    focusRegions: ['Bruxelles', 'Anvers', 'Liège'],
    emailTone: 'direct',
    primaryLanguage: 'fr',
    weeklyGoal: '15 prospects contactés, 1 réponse positive',
    contentTopics: ['web design', 'SEO', 'IA pour PME'],
    priorityAction: 'Augmenter le volume de prospection',
  };
}

// ─── Convergence Check ────────────────────────────────────────────────────────

function checkConvergence(lineage: StrategyLineage): number {
  if (lineage.generations.length < 2) return 0;

  const current = lineage.generations[lineage.generations.length - 1];
  const previous = lineage.generations[lineage.generations.length - 2];

  if (!current || !previous) return 0;

  // Compare strategies — simple field-by-field similarity
  const cs = current.strategy;
  const ps = previous.strategy;

  let matches = 0;
  let total = 0;

  // Sectors overlap
  const sectorOverlap = cs.focusSectors.filter(s => ps.focusSectors.includes(s)).length;
  matches += sectorOverlap / Math.max(cs.focusSectors.length, ps.focusSectors.length);
  total++;

  // Regions overlap
  const regionOverlap = cs.focusRegions.filter(r => ps.focusRegions.includes(r)).length;
  matches += regionOverlap / Math.max(cs.focusRegions.length, ps.focusRegions.length);
  total++;

  // Exact matches
  if (cs.emailTone === ps.emailTone) matches++;
  total++;
  if (cs.primaryLanguage === ps.primaryLanguage) matches++;
  total++;
  if (cs.priorityAction === ps.priorityAction) matches++;
  total++;

  return total > 0 ? matches / total : 0;
}

// ─── Main Evolution Cycle ─────────────────────────────────────────────────────

/**
 * Run the weekly strategy evolution cycle.
 * Called by the autonomous loop during MAINTENANCE task (Sunday 3am).
 */
export async function runStrategyEvolution(): Promise<{
  generation: number;
  converged: boolean;
  mutations: string[];
  insights: string[];
}> {
  logger.info('StrategyEvolver', '=== Weekly Strategy Evolution ===');

  const lineage = loadLineage();
  const currentGen = lineage.generations[lineage.generations.length - 1] ?? null;

  // Check if already converged (stable for 3 weeks)
  if (lineage.converged) {
    logger.info('StrategyEvolver', 'Strategy has converged — skipping evolution');
    return {
      generation: lineage.currentGeneration,
      converged: true,
      mutations: [],
      insights: ['Strategy stable — no evolution needed'],
    };
  }

  // 1. Collect metrics
  const metrics = collectWeekMetrics();
  logger.info('StrategyEvolver', `Metrics: ${metrics.emailsSent} emails, ${metrics.responseRate.toFixed(1)}% response`);

  // 2. Wonder
  const insights = await wonderPhase(metrics, currentGen);
  logger.info('StrategyEvolver', `Wonder: ${insights.length} insights`);

  // 3. Reflect
  const { mutations, newStrategy } = await reflectPhase(insights, currentGen, metrics);
  logger.info('StrategyEvolver', `Reflect: ${mutations.length} mutations`);

  // 4. Create new generation
  const newGenNumber = lineage.currentGeneration + 1;
  const newGeneration: StrategyGeneration = {
    generation: newGenNumber,
    createdAt: new Date().toISOString(),
    strategy: newStrategy,
    metrics,
    wonderInsights: insights,
    reflectMutations: mutations,
    convergenceScore: 0,
  };

  lineage.generations.push(newGeneration);
  lineage.currentGeneration = newGenNumber;

  // 5. Check convergence
  const convergenceScore = checkConvergence(lineage);
  newGeneration.convergenceScore = convergenceScore;

  if (convergenceScore >= 0.95 && lineage.generations.length >= 3) {
    lineage.converged = true;
    lineage.convergedAt = new Date().toISOString();
    logger.info('StrategyEvolver', `CONVERGED at Gen ${newGenNumber} (score: ${convergenceScore.toFixed(2)})`);
  }

  // 6. Save
  saveLineage(lineage);

  // 7. Also update the legacy strategy.json for backward compat
  const legacyStrategy = {
    updatedAt: new Date().toISOString(),
    weeklyGoal: newStrategy.weeklyGoal,
    focusArea: newStrategy.priorityAction.includes('prospect') ? 'prospecting' : 'balanced',
    notes: mutations.slice(0, 5),
    bestPerformingEmailTone: newStrategy.emailTone,
    avgResponseRate: metrics.responseRate,
    generation: newGenNumber,
  };
  const dataDir = path.dirname(STRATEGY_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(STRATEGY_PATH, JSON.stringify(legacyStrategy, null, 2), 'utf8');

  logger.info('StrategyEvolver', `Gen ${newGenNumber} created. Convergence: ${convergenceScore.toFixed(2)}`);

  return {
    generation: newGenNumber,
    converged: lineage.converged,
    mutations,
    insights,
  };
}

/**
 * Get current strategy for use by agents.
 */
export function getCurrentStrategy(): StrategyGeneration['strategy'] | null {
  const lineage = loadLineage();
  const current = lineage.generations[lineage.generations.length - 1];
  return current?.strategy ?? null;
}

/**
 * Get full lineage for dashboard display.
 */
export function getStrategyLineage(): StrategyLineage {
  return loadLineage();
}
