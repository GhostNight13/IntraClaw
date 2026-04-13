import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt, buildCompressedPrompt } from '../memory/core';
import { getWeatherBrussels, formatWeatherFr } from '../tools/weather';
import { rateLimiter } from '../utils/rate-limiter';
import { costTracker } from '../utils/cost-tracker';
import { getStats as getBufferStats } from '../memory/buffer';
import { getUnreadEmails, markAsRead } from '../tools/gmail';
import { updateProspectStatus, getProspectsByStatus } from '../tools/notion';
import { runProspectionAgent } from './prospection';
import { runColdEmailAgent } from './cold-email';
import { runContentAgent } from './content';
import { runReportingAgent } from './reporting';
import { analyzeAndPropose } from './self-improvement';
import { runEnhancedMemory } from '../memory/enhanced';
import { runStrategyEvolution } from '../evolution/strategy-evolver';
import { AgentTask, ProspectStatus } from '../types';
import type { AgentResult } from '../types';

const STRATEGY_PATH = path.resolve(process.cwd(), 'data', 'strategy.json');

// ─── Strategy state ───────────────────────────────────────────────────────────

interface StrategyState {
  updatedAt: string;
  weeklyGoal: string;
  focusArea: 'prospecting' | 'followups' | 'content' | 'balanced';
  notes: string[];
  bestPerformingEmailTone?: string;
  avgResponseRate?: number;
}

function loadStrategy(): StrategyState {
  try {
    if (fs.existsSync(STRATEGY_PATH)) {
      return JSON.parse(fs.readFileSync(STRATEGY_PATH, 'utf8')) as StrategyState;
    }
  } catch {
    logger.warn('Coordinator', 'Failed to load strategy — using defaults');
  }
  return {
    updatedAt:   new Date().toISOString(),
    weeklyGoal:  '2-3 nouveaux prospects convertis',
    focusArea:   'balanced',
    notes:       [],
  };
}

function saveStrategy(state: StrategyState): void {
  try {
    const dir = path.dirname(STRATEGY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STRATEGY_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logger.error('Coordinator', 'Failed to save strategy', err);
  }
}

// ─── Morning brief ────────────────────────────────────────────────────────────

async function generateMorningBrief(): Promise<string> {
  const [weather, ratioStatus, costStatus, repliedProspects] = await Promise.all([
    getWeatherBrussels().catch(() => null),
    Promise.resolve(rateLimiter.getStatus()),
    Promise.resolve(costTracker.getStatus()),
    getProspectsByStatus(ProspectStatus.REPLIED).catch(() => []),
  ]);

  const strategy = loadStrategy();
  const bufferStats = getBufferStats();

  const prompt = `
Tu es IntraClaw. C'est le matin, génère le briefing de la journée pour Ayman.

CONTEXTE :
- Météo Bruxelles : ${weather ? formatWeatherFr(weather) : 'Non disponible'}
- Abonnement Max actif (${costStatus.callCount} appels aujourd'hui, ~${costStatus.spentEur.toFixed(2)}€ equiv.)
- Appels Claude : ${ratioStatus.claude.remaining}/50 restants
- Prospects ayant répondu (à traiter) : ${repliedProspects.length}
- Objectif de la semaine : ${strategy.weeklyGoal}
- Focus actuel : ${strategy.focusArea}
- Messages en mémoire : ${bufferStats.inMemory}

FORMAT :
🌅 **Bonjour Ayman !**

📊 **Statut du jour**
[3-4 lignes sur les métriques importantes]

🎯 **Priorités aujourd'hui**
1. [action 1]
2. [action 2]
3. [action 3]

⚡ **Opportunités immédiates**
[Prospects chauds à contacter aujourd'hui]

💰 **Budget**
[État du budget API]

Sois concis, positif, actionnable.
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildCompressedPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   500,
    temperature: 0.6,
    task: AgentTask.MORNING_BRIEF,
    modelTier:   'fast',  // Structured briefing from pre-gathered data
  });

  return response.content;
}

// ─── Reply detection ──────────────────────────────────────────────────────────

async function processReplies(): Promise<void> {
  logger.info('Coordinator', 'Checking for email replies');

  try {
    const unread = await getUnreadEmails(10);
    if (unread.length === 0) {
      logger.info('Coordinator', 'No unread emails');
      return;
    }

    const contactedProspects = await getProspectsByStatus(ProspectStatus.CONTACTED);

    for (const email of unread) {
      // Check if this is a reply from a prospect we contacted
      const match = contactedProspects.find(p =>
        p.email && email.from.toLowerCase().includes(p.email.toLowerCase())
      );

      if (match) {
        logger.info('Coordinator', `Reply detected from prospect: ${match.businessName}`);
        await updateProspectStatus(match.id, ProspectStatus.REPLIED);
      }

      await markAsRead(email.id);
    }
  } catch (err) {
    logger.warn('Coordinator', 'Reply processing failed', err instanceof Error ? err.message : err);
  }
}

// ─── Self-improvement loop ────────────────────────────────────────────────────

async function runSelfImprovement(): Promise<void> {
  logger.info('Coordinator', '=== Self-improvement loop ===');

  const [contacted, replied, converted] = await Promise.all([
    getProspectsByStatus(ProspectStatus.CONTACTED),
    getProspectsByStatus(ProspectStatus.REPLIED),
    getProspectsByStatus(ProspectStatus.CONVERTED),
  ]);

  const responseRate = contacted.length > 0
    ? (replied.length / contacted.length) * 100
    : 0;

  const conversionRate = replied.length > 0
    ? (converted.length / replied.length) * 100
    : 0;

  const prompt = `
Tu es IntraClaw en mode analyse stratégique.

MÉTRIQUES ACTUELLES :
- Prospects contactés : ${contacted.length}
- Taux de réponse : ${responseRate.toFixed(1)}%
- Taux de conversion (réponse → client) : ${conversionRate.toFixed(1)}%
- Clients convertis : ${converted.length}

BENCHMARK SAIN :
- Taux de réponse cold email B2B : 3-8%
- Taux de conversion prospect → client : 10-20%

ANALYSE :
1. Est-ce que les métriques sont dans la norme ?
2. Quel est le levier prioritaire à travailler ?
3. Propose 1 changement concret et mesurable pour améliorer le taux de réponse
4. Propose un objectif chiffré pour la semaine prochaine

Réponds en JSON :
{
  "assessment": "string",
  "priorityLever": "prospecting|followups|content|email_quality",
  "concreteChange": "string",
  "weeklyGoal": "string",
  "bestEmailTone": "direct|formel|conversationnel"
}
`.trim();

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   400,
      temperature: 0.4,
      task: AgentTask.MAINTENANCE,
      modelTier:   'powerful',  // Strategic analysis needs best reasoning
    });

    const match = response.content.match(/\{[\s\S]*"assessment"[\s\S]*\}/);
    if (!match) {
      logger.warn('Coordinator', 'Self-improvement: no JSON in response');
      return;
    }

    const analysis = JSON.parse(match[0]) as {
      assessment: string;
      priorityLever: StrategyState['focusArea'];
      concreteChange: string;
      weeklyGoal: string;
      bestEmailTone: string;
    };

    const strategy = loadStrategy();
    strategy.updatedAt              = new Date().toISOString();
    strategy.weeklyGoal             = analysis.weeklyGoal;
    strategy.focusArea              = analysis.priorityLever;
    strategy.bestPerformingEmailTone = analysis.bestEmailTone;
    strategy.avgResponseRate        = responseRate;
    strategy.notes.push(`[${new Date().toISOString().slice(0, 10)}] ${analysis.concreteChange}`);
    // Keep only last 10 notes
    if (strategy.notes.length > 10) strategy.notes = strategy.notes.slice(-10);

    saveStrategy(strategy);
    logger.info('Coordinator', 'Strategy updated', {
      focusArea:   strategy.focusArea,
      weeklyGoal:  strategy.weeklyGoal,
    });

    console.log('\n🧠 SELF-IMPROVEMENT ANALYSIS');
    console.log('─'.repeat(50));
    console.log(`Assessment: ${analysis.assessment}`);
    console.log(`Focus: ${analysis.priorityLever}`);
    console.log(`Change: ${analysis.concreteChange}`);
    console.log(`Goal: ${analysis.weeklyGoal}`);
    console.log('─'.repeat(50) + '\n');
  } catch (err) {
    logger.error('Coordinator', 'Self-improvement failed', err instanceof Error ? err.message : err);
  }
}

// ─── Main dispatch ────────────────────────────────────────────────────────────

export async function runTask(task: AgentTask): Promise<AgentResult> {
  logger.info('Coordinator', `Dispatching task: ${task}`);

  // Always process replies when online
  if (task !== AgentTask.MAINTENANCE) {
    await processReplies().catch(err => {
      logger.warn('Coordinator', 'processReplies failed (non-fatal)', err instanceof Error ? err.message : err);
    });
  }

  switch (task) {
    case AgentTask.MORNING_BRIEF: {
      const brief = await generateMorningBrief();
      console.log('\n' + '═'.repeat(60));
      console.log('🌅 MORNING BRIEF — ' + new Date().toLocaleString('fr-BE'));
      console.log('═'.repeat(60));
      console.log(brief);
      console.log('═'.repeat(60) + '\n');
      return {
        task,
        success:    true,
        data:       { brief },
        durationMs: 0,
        model:      'claude',
        timestamp:  new Date().toISOString(),
      };
    }

    case AgentTask.PROSPECTING:
      return runProspectionAgent();

    case AgentTask.CONTENT:
      return runContentAgent();

    case AgentTask.COLD_EMAIL:
      return runColdEmailAgent();

    case AgentTask.EVENING_REPORT:
      return runReportingAgent(false);

    case AgentTask.MAINTENANCE: {
      const report = await runReportingAgent(true);
      await runSelfImprovement();
      // Module 3: analyze logs and propose code improvements
      await analyzeAndPropose().catch(err =>
        logger.warn('Coordinator', 'Self-improvement analysis failed (non-fatal)', err instanceof Error ? err.message : err)
      );
      // Module 4: update heartbeat + integrate learned facts
      await runEnhancedMemory().catch(err =>
        logger.warn('Coordinator', 'Enhanced memory cycle failed (non-fatal)', err instanceof Error ? err.message : err)
      );
      // Module 5: weekly Ouroboros strategy evolution — Wonder/Reflect cycle
      await runStrategyEvolution().catch(err =>
        logger.warn('Coordinator', 'Strategy evolution failed (non-fatal)', err instanceof Error ? err.message : err)
      );
      return report;
    }

    default: {
      const _exhaustive: never = task;
      logger.error('Coordinator', `Unknown task: ${_exhaustive}`);
      return {
        task,
        success:    false,
        error:      `Unknown task: ${task}`,
        durationMs: 0,
        model:      'none',
        timestamp:  new Date().toISOString(),
      };
    }
  }
}
