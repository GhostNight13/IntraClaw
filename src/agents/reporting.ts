import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildCompressedPrompt } from '../memory/core';
import { rateLimiter } from '../utils/rate-limiter';
import { costTracker } from '../utils/cost-tracker';
import { getProspectsByStatus } from '../tools/notion';
import { getClients } from '../tools/notion';
import { getEmailsSentToday } from './cold-email';
import { ProspectStatus, AgentTask } from '../types';
import type { AgentResult, DailyReport } from '../types';

const REPORTS_DIR = path.resolve(process.cwd(), 'data', 'reports');

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RawStats {
  date: string;
  prospectsNew: number;
  prospectsContacted: number;
  prospectsReplied: number;
  emailsSentToday: number;
  totalClients: number;
  totalRevenue: number;
  apiCalls: { claude: number; gmail: number; scraping: number };
  costEur: number;
  costRemainingEur: number;
}

async function gatherStats(): Promise<RawStats> {
  const [
    newProspects,
    contactedProspects,
    repliedProspects,
    clients,
  ] = await Promise.all([
    getProspectsByStatus(ProspectStatus.NEW),
    getProspectsByStatus(ProspectStatus.CONTACTED),
    getProspectsByStatus(ProspectStatus.REPLIED),
    getClients(),
  ]);

  const ratioStatus = rateLimiter.getStatus();
  const cost = costTracker.getStatus();
  const totalRevenue = clients.reduce((sum, c) => sum + c.revenue, 0);

  return {
    date:                  getTodayStr(),
    prospectsNew:          newProspects.length,
    prospectsContacted:    contactedProspects.length,
    prospectsReplied:      repliedProspects.length,
    emailsSentToday:       getEmailsSentToday(),
    totalClients:          clients.length,
    totalRevenue,
    apiCalls: {
      claude:   ratioStatus.claude.count,
      gmail:    ratioStatus.gmail.count,
      scraping: ratioStatus.scraping.count,
    },
    costEur:               cost.spentEur,
    costRemainingEur:      0, // Max subscription — no remaining budget concept
  };
}

async function generateReportNarrative(stats: RawStats): Promise<string> {
  const prompt = `
Tu es IntraClaw. Génère le rapport du soir pour Ayman.

DONNÉES DU JOUR (${stats.date}) :
- Nouveaux prospects en base : ${stats.prospectsNew}
- Prospects contactés (total) : ${stats.prospectsContacted}
- Prospects ayant répondu : ${stats.prospectsReplied}
- Emails envoyés aujourd'hui : ${stats.emailsSentToday}
- Clients convertis (total) : ${stats.totalClients}
- Chiffre d'affaires généré : ${stats.totalRevenue}€
- Appels Claude : ${stats.apiCalls.claude}/50
- Appels Gmail : ${stats.apiCalls.gmail}/50
- Scraping : ${stats.apiCalls.scraping}/100
- Coût API aujourd'hui : ${stats.costEur.toFixed(3)}€ (reste ${stats.costRemainingEur.toFixed(3)}€)

FORMAT OBLIGATOIRE :
📊 **MÉTRIQUES DU JOUR**
[résumé chiffré concis]

✅ **WINS**
[1-3 points positifs]

🚧 **BLOCKERS**
[problèmes détectés]

🎯 **ACTIONS DEMAIN**
[2-3 actions prioritaires]

💡 **INSIGHT**
[1 observation stratégique basée sur les données]

Sois concis, data-driven. Pas de blabla.
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildCompressedPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   600,
    temperature: 0.6,
    task: AgentTask.EVENING_REPORT,
    modelTier:   'fast',  // Stats compilation from pre-gathered data
  });

  return response.content;
}

async function generateMaintenanceReport(stats: RawStats): Promise<string> {
  const prompt = `
Tu es IntraClaw. C'est dimanche 3h, mode maintenance hebdomadaire.

STATS DE LA SEMAINE :
- Prospects contactés : ${stats.prospectsContacted}
- Réponses reçues : ${stats.prospectsReplied}
- Taux de réponse : ${stats.prospectsContacted > 0
    ? ((stats.prospectsReplied / stats.prospectsContacted) * 100).toFixed(1)
    : '0'}%
- Clients convertis : ${stats.totalClients}
- CA total : ${stats.totalRevenue}€
- Coût API semaine : ${(stats.costEur * 7).toFixed(2)}€ (estimation)

ANALYSE OBLIGATOIRE :
1. Ce qui a fonctionné (avec données à l'appui)
2. Ce qui n'a pas marché
3. Hypothèse sur pourquoi
4. 2-3 ajustements concrets pour la semaine prochaine
5. Objectif semaine prochaine (1 métrique clé)

Méthode OODA. Sois data-driven.
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildCompressedPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   800,
    temperature: 0.5,
    task: AgentTask.MAINTENANCE,
    modelTier:   'fast',  // Weekly stats compilation
  });

  return response.content;
}

export async function runReportingAgent(isMaintenance = false): Promise<AgentResult<DailyReport>> {
  const start = Date.now();
  logger.info('Reporting', `=== Starting ${isMaintenance ? 'maintenance' : 'evening'} report ===`);

  try {
    ensureReportsDir();
    const stats = await gatherStats();

    const narrative = isMaintenance
      ? await generateMaintenanceReport(stats)
      : await generateReportNarrative(stats);

    // Print report to console
    console.log('\n' + '═'.repeat(60));
    console.log(`📋 INTRACLAW REPORT — ${stats.date}`);
    console.log('═'.repeat(60));
    console.log(narrative);
    console.log('═'.repeat(60) + '\n');

    // Save report to disk
    const reportPath = path.join(REPORTS_DIR, `report-${stats.date}.md`);
    const reportContent = `# IntraClaw Report — ${stats.date}\n\n${narrative}\n\n---\n\n**Raw stats:** ${JSON.stringify(stats, null, 2)}`;
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    logger.info('Reporting', `Report saved: ${reportPath}`);

    const report: DailyReport = {
      id:                 `report-${stats.date}`,
      date:               stats.date,
      prospectsFound:     stats.prospectsNew,
      emailsSent:         stats.emailsSentToday,
      repliesReceived:    stats.prospectsReplied,
      contentPublished:   0, // updated by content agent
      costEur:            stats.costEur,
      apiCalls:           stats.apiCalls.claude + stats.apiCalls.gmail,
      highlights:         [],
      blockers:           [],
      nextActions:        [],
      generatedAt:        new Date().toISOString(),
    };

    return {
      task:       isMaintenance ? AgentTask.MAINTENANCE : AgentTask.EVENING_REPORT,
      success:    true,
      data:       report,
      durationMs: Date.now() - start,
      model:      'claude',
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Reporting', 'Agent failed', message);
    return {
      task:       AgentTask.EVENING_REPORT,
      success:    false,
      error:      message,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}
