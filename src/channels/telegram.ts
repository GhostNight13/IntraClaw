import { Bot, Context } from 'grammy';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';
import { costTracker } from '../utils/cost-tracker';
import { getProspectsByStatus } from '../tools/notion';
import { getEmailsSentToday, setColdEmailNotifier } from '../agents/cold-email';
import { runColdEmailAgent } from '../agents/cold-email';
import { runProspectionAgent } from '../agents/prospection';
import { runTask } from '../agents/coordinator';
import { resolveBlockedTask, getPendingBlockedTasks } from '../agents/autonomous-runner';
import { getPendingProposals, approveProposal, rejectProposal, applyProposal } from '../agents/self-improvement';
import { stopScheduler, startScheduler, getJobs } from '../scheduler';
import { ProspectStatus, AgentTask } from '../types';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { getLoopState, pauseLoop, resumeLoop } from '../loop/autonomous-loop';
import { notifyUserActivity as consciousnessNotifyActivity } from '../evolution/consciousness';
import { getPrioritizedGoals } from '../reasoning/goal-manager';
import { executeUniversalTask } from '../executor/universal-executor';
import { runEvolutionCycle } from '../evolution/evolution-engine';
import { readVersion } from '../evolution/version';
import { setConfirmationNotifier, approveByCode, rejectByCode, listPending } from '../security/confirmation';
import { t } from '../i18n';
import { isAgencyEnabled } from '../plugins/agency-flag';

// ─── Config ───────────────────────────────────────────────────────────────────

const TOKEN          = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER   = process.env.TELEGRAM_ALLOWED_USER_ID
  ? parseInt(process.env.TELEGRAM_ALLOWED_USER_ID, 10)
  : null;

let bot: Bot | null = null;
let schedulerPaused = false;

// ─── Auth middleware ───────────────────────────────────────────────────────────

function isAllowed(ctx: Context): boolean {
  if (!ALLOWED_USER) return false;
  return ctx.from?.id === ALLOWED_USER;
}

async function guardUser(ctx: Context): Promise<boolean> {
  if (!isAllowed(ctx)) {
    logger.warn('Telegram', `Unauthorized access attempt from user ${ctx.from?.id}`);
    await ctx.reply(t('telegram:unauthorized'));
    return false;
  }
  return true;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function handleStatus(ctx: Context): Promise<void> {
  const rate = rateLimiter.getStatus();
  const cost = costTracker.getStatus();
  const jobs = getJobs();

  const lines = [
    `📊 *IntraClaw Status*`,
    ``,
    `*Pipeline*`,
    `  Claude:   ${rate.claude.count}/${rate.claude.max} appels`,
    `  Gmail:    ${rate.gmail.count}/${rate.gmail.max} emails`,
    `  Scraping: ${rate.scraping.count}/${rate.scraping.max} requêtes`,
    ``,
    `*Budget API*`,
    `  Appels:   ${cost.callCount} aujourd'hui (~${cost.spentEur.toFixed(3)}€ equiv.)`,
    `  Abonnement: ${cost.budgetEur}`,
    ``,
    `*Scheduler*`,
    `  Statut: ${schedulerPaused ? '⏸ En pause' : '▶️ Actif'}`,
    `  Jobs: ${jobs.filter(j => j.enabled).length}/${jobs.length} actifs`,
    ``,
    `*Emails aujourd'hui:* ${getEmailsSentToday()}`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

async function handleReport(ctx: Context): Promise<void> {
  await ctx.reply('📋 Génération du rapport en cours...');
  try {
    const result = await runTask(AgentTask.EVENING_REPORT);
    if (result.success) {
      await ctx.reply('✅ Rapport généré et sauvegardé dans `data/reports/`', { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`❌ Erreur rapport: ${result.error}`);
    }
  } catch (err) {
    await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleProspects(ctx: Context): Promise<void> {
  try {
    const [newP, contacted, replied, converted] = await Promise.all([
      getProspectsByStatus(ProspectStatus.NEW),
      getProspectsByStatus(ProspectStatus.CONTACTED),
      getProspectsByStatus(ProspectStatus.REPLIED),
      getProspectsByStatus(ProspectStatus.CONVERTED),
    ]);

    const lines = [
      `👥 *Prospects IntraClaw*`,
      ``,
      `🔵 Nouveaux:    ${newP.length}`,
      `📧 Contactés:   ${contacted.length}`,
      `💬 Réponses:    ${replied.length}`,
      `✅ Convertis:   ${converted.length}`,
      ``,
      `Taux de réponse: ${contacted.length > 0
        ? ((replied.length / contacted.length) * 100).toFixed(1)
        : '0'}%`,
      `Taux conversion: ${replied.length > 0
        ? ((converted.length / replied.length) * 100).toFixed(1)
        : '0'}%`,
    ];

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Erreur Notion: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handlePause(ctx: Context): Promise<void> {
  if (schedulerPaused) {
    await ctx.reply('⚠️ Scheduler déjà en pause.');
    return;
  }
  stopScheduler();
  schedulerPaused = true;
  logger.info('Telegram', 'Scheduler paused by user');
  await ctx.reply('⏸ Scheduler mis en pause. Tous les cron jobs sont stoppés.\nUtilise /resume pour reprendre.');
}

async function handleResume(ctx: Context): Promise<void> {
  if (!schedulerPaused) {
    await ctx.reply('⚠️ Scheduler déjà actif.');
    return;
  }
  startScheduler();
  schedulerPaused = false;
  logger.info('Telegram', 'Scheduler resumed by user');
  await ctx.reply('▶️ Scheduler repris. 6 jobs actifs (Europe/Brussels).');
}

async function handleUnblock(ctx: Context): Promise<void> {
  // Usage: /unblock <id> <retry|skip|abort> [note...]
  const text = ctx.message?.text ?? '';
  const parts = text.trim().split(/\s+/);
  // parts[0] = '/unblock', parts[1] = id, parts[2] = command, parts[3..] = optional note

  if (parts.length < 3) {
    await ctx.reply(
      '⚠️ Usage: `/unblock <id> <retry|skip|abort> [note]`\n\n' +
      'Exemple: `/unblock 1 retry`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const id = parseInt(parts[1]!, 10);
  const command = parts[2]!.toLowerCase() as 'retry' | 'skip' | 'abort';
  const note = parts.slice(3).join(' ');

  if (isNaN(id)) {
    await ctx.reply('❌ ID invalide. Doit être un nombre.');
    return;
  }

  if (!['retry', 'skip', 'abort'].includes(command)) {
    await ctx.reply('❌ Commande invalide. Choix: `retry`, `skip`, `abort`', { parse_mode: 'Markdown' });
    return;
  }

  try {
    resolveBlockedTask(id, command, note);
    const emoji = command === 'retry' ? '🔄' : command === 'abort' ? '🛑' : '⏭';
    await ctx.reply(
      `${emoji} Tâche #${id} débloquée: *${command}*${note ? `\nNote: ${note}` : ''}`,
      { parse_mode: 'Markdown' }
    );
    logger.info('Telegram', `User unblocked task #${id} with ${command}`);
  } catch (err) {
    await ctx.reply(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleBlocked(ctx: Context): Promise<void> {
  try {
    const blocked = getPendingBlockedTasks();
    if (blocked.length === 0) {
      await ctx.reply('✅ Aucune tâche bloquée en attente.');
      return;
    }

    const lines = [
      `🚧 *Tâches bloquées (${blocked.length})*`,
      '',
    ];

    for (const t of blocked) {
      lines.push(
        `🔸 *#${t.id}* — \`${t.task}\``,
        `   ❌ ${t.reason}`,
        `   🔄 ${t.attempts} tentative(s) — ${new Date(t.created_at).toLocaleString('fr-BE')}`,
        `   → /unblock ${t.id} retry | skip | abort`,
        '',
      );
    }

    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleProposals(ctx: Context): Promise<void> {
  const proposals = getPendingProposals();
  if (proposals.length === 0) {
    await ctx.reply('✅ Aucune proposition d\'amélioration en attente.');
    return;
  }

  const lines = [`🧠 *Propositions d'amélioration (${proposals.length})*`, ''];

  for (const p of proposals) {
    lines.push(
      `🔹 *${p.id.slice(-8)}* — ${p.title}`,
      `   📄 \`${p.targetFile}\``,
      `   💡 ${p.reasoning.slice(0, 120)}`,
      `   → /approve ${p.id.slice(-8)} | /reject ${p.id.slice(-8)}`,
      '',
    );
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
}

async function handleApprove(ctx: Context): Promise<void> {
  const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
  const shortId = parts[1];

  if (!shortId) {
    await ctx.reply('⚠️ Usage: `/approve <id>` — vois /proposals pour les IDs', { parse_mode: 'Markdown' });
    return;
  }

  const proposals = getPendingProposals();
  const proposal = proposals.find(p => p.id.endsWith(shortId));

  if (!proposal) {
    await ctx.reply(`❌ Proposition \`${shortId}\` non trouvée ou déjà traitée.`, { parse_mode: 'Markdown' });
    return;
  }

  approveProposal(proposal.id);
  await ctx.reply(`✅ Proposition approuvée. Application en cours...`);

  try {
    const result = await applyProposal(proposal.id);
    if (result.success) {
      await ctx.reply(
        `✅ *Amélioration appliquée !*\n` +
        `📄 \`${proposal.targetFile}\`\n` +
        `🔒 Backup: \`${(result.data as { backup: string }).backup}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(`❌ Échec application: ${result.error}`);
    }
  } catch (err) {
    await ctx.reply(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleReject(ctx: Context): Promise<void> {
  const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
  const shortId = parts[1];
  const reason = parts.slice(2).join(' ');

  if (!shortId) {
    await ctx.reply('⚠️ Usage: `/reject <id> [raison]`', { parse_mode: 'Markdown' });
    return;
  }

  const proposals = getPendingProposals();
  const proposal = proposals.find(p => p.id.endsWith(shortId));

  if (!proposal) {
    await ctx.reply(`❌ Proposition \`${shortId}\` non trouvée.`, { parse_mode: 'Markdown' });
    return;
  }

  rejectProposal(proposal.id, reason);
  await ctx.reply(`🚫 Proposition *${proposal.title}* rejetée.${reason ? `\nRaison: ${reason}` : ''}`, { parse_mode: 'Markdown' });
}

// ─── Evolution (Ouroboros) command ────────────────────────────────────────────

async function handleEvolve(ctx: Context): Promise<void> {
  const versionBefore = readVersion();
  await ctx.reply(
    `🧬 *Cycle d'évolution démarré*\n` +
    `Version actuelle : \`${versionBefore}\`\n` +
    `Étapes : candidat → LLM → constitution → tsc → review → commit → vérif post-commit.\n` +
    `Durée : typiquement 1-3 min…`,
    { parse_mode: 'Markdown' }
  );

  try {
    const result = await runEvolutionCycle('telegram-manual');

    // Send as plain text (no parse_mode) — dynamic content from the LLM
    // (rationale, violations, reviewer reason, file paths with underscores)
    // often contains unbalanced Markdown entities which crash sendMessage
    // with "can't parse entities". Use plain quotes instead of backticks.
    const lines: string[] = [];
    const emoji = outcomeEmoji(result.outcome);
    lines.push(`${emoji} Cycle terminé : ${result.outcome}`);
    lines.push(`⏱ ${(result.durationMs / 1000).toFixed(1)}s`);
    lines.push(`📌 Version : ${result.versionBefore} → ${result.versionAfter}`);
    if (result.filePath)  lines.push(`📄 Fichier : ${result.filePath}`);
    if (result.sha)       lines.push(`🔖 Commit : ${result.sha.slice(0, 12)}`);
    if (result.rationale) lines.push(`💡 ${result.rationale.slice(0, 400)}`);
    if (result.violations && result.violations.length > 0) {
      lines.push(`⚠️ Violations :`);
      for (const v of result.violations.slice(0, 5)) lines.push(`  • ${v.slice(0, 160)}`);
    }
    if (result.reviewerReason) lines.push(`🛡 Reviewer : ${result.reviewerReason.slice(0, 240)}`);
    if (result.error)          lines.push(`❌ Erreur : ${result.error.slice(0, 400)}`);

    await ctx.reply(lines.join('\n'));
  } catch (err) {
    logger.error('Telegram', 'Evolution cycle crashed', err instanceof Error ? err.message : err);
    await ctx.reply(`❌ Cycle crashé : ${err instanceof Error ? err.message : String(err)}`);
  }
}

function outcomeEmoji(outcome: string): string {
  switch (outcome) {
    case 'committed':                return '✅';
    case 'committed-and-restarted':  return '🔄';
    case 'rejected-by-constitution': return '📜';
    case 'rejected-by-reviewer':     return '🛡';
    case 'rejected-by-tsc':          return '🧪';
    case 'rolled-back':              return '↩️';
    case 'no-candidate':             return '🫥';
    default:                         return '❌';
  }
}

async function handleText(ctx: Context): Promise<void> {
  const raw = (ctx.message?.text ?? '').trim();
  if (!raw || raw.startsWith('/')) return;

  // Tell the background consciousness to shut up for 5 min — don't talk over the user
  try { consciousnessNotifyActivity(); } catch { /* non-fatal */ }

  const lower = raw.toLowerCase();
  logger.info('Telegram', `Chat: "${raw.slice(0, 100)}"`);

  // ─── Quick intent detection (no AI call needed) ─────────────────────────────

  // Pause / stop loop
  if (/\b(pause|arrête|stop|arrêter|stoppe)\b/i.test(lower) && !/prospect|email|mail/i.test(lower)) {
    const state = getLoopState();
    if (!state.running) {
      await ctx.reply('⚠️ La boucle autonome n\'est pas active.');
      return;
    }
    if (state.paused) {
      await ctx.reply('⚠️ Déjà en pause.');
      return;
    }
    pauseLoop('Requested by user via Telegram');
    stopScheduler();
    schedulerPaused = true;
    await ctx.reply('⏸ Boucle autonome + scheduler en pause.\nDis "reprends" pour relancer.');
    return;
  }

  // Resume loop
  if (/\b(reprend|resume|relance|restart|redémarre)\b/i.test(lower)) {
    const state = getLoopState();
    if (state.running && !state.paused && !schedulerPaused) {
      await ctx.reply('⚠️ Tout est déjà actif !');
      return;
    }
    if (state.paused) resumeLoop();
    if (schedulerPaused) { startScheduler(); schedulerPaused = false; }
    await ctx.reply('▶️ Boucle autonome + scheduler relancés !');
    return;
  }

  // Quick status (natural language)
  if (/\b(status|état|comment (ça|ca) va|how.*going|ça roule)\b/i.test(lower) && !/prospect/i.test(lower)) {
    const state = getLoopState();
    const goals = getPrioritizedGoals().slice(0, 3);
    const lines = [
      `🤖 *IntraClaw* ${state.running ? (state.paused ? '⏸ Pausé' : '🟢 Actif') : '🔴 Arrêté'}`,
      `📊 Itération #${state.iteration}`,
      `⚡ ${state.totalActionsToday} actions aujourd'hui`,
      state.consecutiveFailures > 0 ? `⚠️ ${state.consecutiveFailures} échecs consécutifs` : '✅ Aucun échec',
      `🕐 Dernière action : ${state.lastActionType ?? 'aucune'}`,
    ];
    if (goals.length > 0) {
      lines.push('', '🎯 *Objectifs actifs :*');
      for (const g of goals) lines.push(`  • [${g.priority}] ${g.title}`);
    }
    await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    return;
  }

  // ─── Action intent routing (triggers agent tasks) ───────────────────────────
  // Agency-specific intents (prospection, cold email, content) — gated by flag.
  const agencyOn = isAgencyEnabled();

  // Tighter prospection match: require explicit business/lead context so
  // generic "cherche" / "trouve" (web search, factual lookups) falls through
  // to the universal executor instead of triggering the CRM agent.
  const isProspect = agencyOn && (
    /\b(prospects?|leads?)\b/i.test(lower) ||
    /\b(cherche|trouve|research|recherche)\b[^.!?]*\b(prospect|lead|client|entreprise|boite|boîte|société|business|site web|agence)/i.test(lower)
  );
  const isEmail    = agencyOn && /\b(cold\s?email|cold\s?mail|envoie.*email|envoi.*email|envoie.*mail|contact.*prospect)\b/i.test(lower);
  const isContent  = agencyOn && /\b(post\s?linkedin|contenu\s?linkedin|génère.*post|publi.*linkedin)\b/i.test(lower);
  const isReport   = /\b(rapport\s?(du\s?jour|journalier|quotidien)?|bilan\s?(du\s?jour)?|résumé\s?(du\s?jour|journée)?)\b/i.test(lower);

  if (isProspect && isEmail) {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('🔍 Recherche de prospects + envoi emails en cours...\n⏳ 5-10 minutes.');
    try {
      const p = await runProspectionAgent();
      await ctx.reply(`✅ Prospection: ${(p.data as { prospectsAdded: number })?.prospectsAdded ?? 0} prospects ajoutés.`);
      const e = await runColdEmailAgent();
      const ed = e.data as { emailsSent: number; followUpsSent: number } | undefined;
      await ctx.reply(`📧 Emails: ${ed?.emailsSent ?? 0} cold + ${ed?.followUpsSent ?? 0} relances.`);
    } catch (err) {
      await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
    return;
  }

  if (isProspect) {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('🔍 Prospection en cours... ⏳ 3-5 min.');
    try {
      const result = await runProspectionAgent();
      const d = result.data as { prospectsAdded: number } | undefined;
      await ctx.reply(
        result.success
          ? `✅ *${d?.prospectsAdded ?? 0} nouveaux prospects* ajoutés au CRM.`
          : `❌ Erreur: ${result.error}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    return;
  }

  if (isEmail) {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('📧 Envoi cold emails... ⏳ 3-5 min.');
    try {
      const result = await runColdEmailAgent();
      const d = result.data as { emailsSent: number; followUpsSent: number } | undefined;
      await ctx.reply(
        result.success
          ? `✅ *${d?.emailsSent ?? 0} cold emails* + *${d?.followUpsSent ?? 0} relances*`
          : `❌ Erreur: ${result.error}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    return;
  }

  if (isReport) {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('📋 Génération du rapport...');
    try {
      const result = await runTask(AgentTask.EVENING_REPORT);
      if (result.success && result.data && typeof result.data === 'object' && 'brief' in result.data) {
        await ctx.reply((result.data as { brief: string }).brief.slice(0, 4000));
      } else {
        await ctx.reply('✅ Rapport généré. Check les logs.');
      }
    } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    return;
  }

  if (isContent) {
    await ctx.replyWithChatAction('typing');
    await ctx.reply('✍️ Génération contenu...');
    try {
      const result = await runTask(AgentTask.CONTENT);
      await ctx.reply(result.success ? '✅ Contenu généré et sauvegardé.' : `❌ ${result.error}`);
    } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    return;
  }

  // ─── Universal Task Executor — complex action requests ──────────────────────

  const actionPatterns = [
    /^(cr[ée]+|fais|fait|build|g[ée]n[èe]re|envoie|d[ée]ploie|installe|configure|cherche|analyse|recherche|t[ée]l[ée]charge|ouvre|lance|modifie|update|upload|download|scrape)/i,
    /^(lis|lire|regarde|vérifie|verifie|compare|calcule|montre|affiche|explique|trouve|convertis|traduis|résume|resume|teste|test|supprime|nettoie|optimise|refactor|debug|fix|corrige)/i,
    /^(je veux|j'veux|jveux|il faut|il me faut|peux-tu|peux tu|est-ce que tu peux)/i,
    // Multi-step: sentence contains action verb + "puis" / "ensuite" / "et après"
    /\b(puis|ensuite|et après|et compare|et résume|et dis|et liste)\b/i,
  ];

  const isActionRequest = actionPatterns.some(p => p.test(raw.trim()));

  if (isActionRequest && raw.length > 15) {
    await ctx.reply(t('telegram:thinking'));

    try {
      let lastStepShown = -1;
      const result = await executeUniversalTask(raw, (progress) => {
        // Stream each step's description + tool live, once per step
        const idx = progress.currentStep - 1;
        if (idx > lastStepShown && idx >= 0 && idx < progress.steps.length) {
          lastStepShown = idx;
          const step = progress.steps[idx];
          if (step) {
            const icon = step.success ? '🔧' : '⚠️';
            const preview = step.description.slice(0, 80);
            ctx.reply(`${icon} \`${step.tool}\` — ${preview}`, { parse_mode: 'Markdown' }).catch(() => {});
          }
        }
      });

      if (result.status === 'completed') {
        await ctx.reply(`${t('telegram:task_completed')}\n\n${(result.finalOutput ?? '').slice(0, 3000)}`);
      } else {
        await ctx.reply(t('telegram:task_failed', { error: result.error ?? t('telegram:unknown_error') }));
      }
    } catch (err) {
      logger.error('Telegram', 'Universal task executor failed', err instanceof Error ? err.message : err);
      await ctx.reply('❌ Erreur dans l\'exécution de la tâche.');
    }
    return;
  }

  // ─── Conversational AI fallback — Claude responds naturally ─────────────────

  await ctx.replyWithChatAction('typing');

  try {
    const response = await handleNaturalChat(raw);
    await ctx.reply(response, { parse_mode: 'Markdown' });
  } catch (err) {
    logger.error('Telegram', 'Chat AI response failed', err instanceof Error ? err.message : err);
    await ctx.reply('❌ Erreur dans le traitement de ton message.');
  }
}

// ─── Natural chat — Claude conversational AI ────────────────────────────────

async function handleNaturalChat(message: string): Promise<string> {
  const loopState = getLoopState();
  const goals = getPrioritizedGoals();

  const context = `ÉTAT ACTUEL D'INTRACLAW :
- Boucle : ${loopState.running ? (loopState.paused ? 'pausée' : 'active') : 'arrêtée'}
- Itération : #${loopState.iteration}
- Dernière action : ${loopState.lastActionType ?? 'aucune'}
- Actions aujourd'hui : ${loopState.totalActionsToday}
- Échecs consécutifs : ${loopState.consecutiveFailures}
- Scheduler : ${schedulerPaused ? 'en pause' : 'actif'}

OBJECTIFS ACTIFS :
${goals.length > 0 ? goals.slice(0, 5).map(g => `- [${g.priority}] ${g.title}`).join('\n') : '- Aucun objectif défini'}

COMMANDES DISPONIBLES (que l'utilisateur peut utiliser) :
- "pause" / "stop" → met en pause la boucle
- "reprends" / "resume" → relance la boucle
- "status" → voir l'état
- "cherche des prospects" → prospection
- "envoie des emails" → cold emails
- "génère un rapport" → rapport du jour`;

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: `${context}\n\nL'utilisateur te dit via Telegram :\n"${message}"\n\nRéponds de manière concise, utile et amicale. Tu es IntraClaw, un agent IA personnel. Si l'utilisateur demande une action (pause, reprise, trigger une tâche), explique-lui la commande à taper. Si c'est une question générale, réponds intelligemment. Maximum 400 caractères.`,
      },
    ],
    maxTokens: 300,
    temperature: 0.6,
    task: AgentTask.MORNING_BRIEF,
    modelTier: 'fast',
  });

  return response.content;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialize the Telegram bot.
 * No-ops if TELEGRAM_BOT_TOKEN is not set (graceful degradation).
 */
export function initTelegram(): void {
  if (!TOKEN) {
    logger.warn('Telegram', 'TELEGRAM_BOT_TOKEN not set — Telegram channel disabled');
    return;
  }
  if (!ALLOWED_USER) {
    logger.warn('Telegram', 'TELEGRAM_ALLOWED_USER_ID not set — Telegram channel disabled');
    return;
  }

  bot = new Bot(TOKEN);

  // Commands
  bot.command('start',     async ctx => {
    if (!await guardUser(ctx)) return;
    await ctx.reply(
      '👋 *IntraClaw connecté*\n\n' +
      'Commandes disponibles :\n' +
      '/status — Stats du pipeline\n' +
      '/report — Rapport du jour\n' +
      '/prospects — Vue prospects\n' +
      '/pause — Pause les cron jobs\n' +
      '/resume — Reprend les cron jobs\n' +
      '/blocked — Voir les tâches bloquées\n' +
      '/unblock <id> <retry|skip|abort> — Débloquer une tâche\n' +
      '/proposals — Voir les propositions d\'amélioration\n' +
      '/approve <id> — Approuver et appliquer une amélioration\n' +
      '/reject <id> — Rejeter une proposition\n' +
      '/evolve — Lancer un cycle Ouroboros (auto-commit sur branche evolution)',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status',    async ctx => { if (await guardUser(ctx)) await handleStatus(ctx); });
  bot.command('report',    async ctx => { if (await guardUser(ctx)) await handleReport(ctx); });
  // ─── Agency-only commands (gated by ENABLE_AGENCY_AGENTS) ────────────
  if (isAgencyEnabled()) {
    bot.command('prospects', async ctx => { if (await guardUser(ctx)) await handleProspects(ctx); });
  }
  bot.command('pause',     async ctx => { if (await guardUser(ctx)) await handlePause(ctx); });
  bot.command('resume',    async ctx => { if (await guardUser(ctx)) await handleResume(ctx); });
  bot.command('blocked',   async ctx => { if (await guardUser(ctx)) await handleBlocked(ctx); });
  bot.command('unblock',   async ctx => { if (await guardUser(ctx)) await handleUnblock(ctx); });
  bot.command('proposals', async ctx => { if (await guardUser(ctx)) await handleProposals(ctx); });
  bot.command('approve',   async ctx => { if (await guardUser(ctx)) await handleApprove(ctx); });
  bot.command('reject',    async ctx => { if (await guardUser(ctx)) await handleReject(ctx); });
  bot.command('evolve',    async ctx => { if (await guardUser(ctx)) await handleEvolve(ctx); });

  // ─── Human-in-the-loop confirmation ──────────────────────────────────────
  bot.command('yes', async ctx => {
    if (!await guardUser(ctx)) return;
    const code = ctx.match?.toString().trim();
    if (!code) { await ctx.reply('Usage: `/yes <code>`'); return; }
    const res = approveByCode(code);
    await ctx.reply(res.message);
  });
  bot.command('no', async ctx => {
    if (!await guardUser(ctx)) return;
    const code = ctx.match?.toString().trim();
    if (!code) { await ctx.reply('Usage: `/no <code>`'); return; }
    const res = rejectByCode(code);
    await ctx.reply(res.message);
  });
  bot.command('pending', async ctx => {
    if (!await guardUser(ctx)) return;
    const list = listPending();
    if (list.length === 0) { await ctx.reply('✅ Aucune confirmation en attente.'); return; }
    const lines = list.map(p =>
      `• [${p.kind}] ${p.description.slice(0, 80)} — /yes ${p.code} | /no ${p.code}`,
    );
    await ctx.reply('⏳ *En attente :*\n' + lines.join('\n'), { parse_mode: 'Markdown' });
  });

  if (isAgencyEnabled()) {
    bot.command('prospect', async ctx => {
      if (!await guardUser(ctx)) return;
      await ctx.reply('🔍 Prospection lancée...');
      try {
        const result = await runProspectionAgent();
        const d = result.data as { prospectsAdded: number } | undefined;
        await ctx.reply(`✅ ${d?.prospectsAdded ?? 0} prospects ajoutés.`);
      } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    });
    bot.command('email', async ctx => {
      if (!await guardUser(ctx)) return;
      await ctx.reply('📧 Envoi emails lancé...');
      try {
        const result = await runColdEmailAgent();
        const d = result.data as { emailsSent: number; followUpsSent: number } | undefined;
        await ctx.reply(`✅ ${d?.emailsSent ?? 0} cold emails + ${d?.followUpsSent ?? 0} relances.`);
      } catch (err) { await ctx.reply(`❌ ${err instanceof Error ? err.message : String(err)}`); }
    });
  }

  // Free text → coordinator
  bot.on('message:text', async ctx => {
    if (!await guardUser(ctx)) return;
    await handleText(ctx);
  });

  // Error handler
  bot.catch(err => {
    logger.error('Telegram', 'Bot error', err.message);
  });

  // Start polling (non-blocking)
  bot.start({
    onStart: () => logger.info('Telegram', 'Bot polling started'),
  }).catch(err => {
    logger.error('Telegram', 'Bot start failed', err instanceof Error ? err.message : err);
  });

  // Wire cold-email notifier (avoids circular import)
  setColdEmailNotifier(sendTelegramMessage);
  setConfirmationNotifier(sendTelegramMessage);

  logger.info('Telegram', `Bot initialized — authorized user: ${ALLOWED_USER}`);
}

/**
 * Send a proactive message to the authorized user.
 * Called by scheduler / coordinator for briefings & alerts.
 */
export async function sendTelegramMessage(text: string): Promise<void> {
  if (!bot || !ALLOWED_USER) return;

  try {
    // Telegram limit: 4096 chars
    const truncated = text.slice(0, 4000);
    await bot.api.sendMessage(ALLOWED_USER, truncated, { parse_mode: 'Markdown' });
    logger.info('Telegram', `Message sent (${truncated.length} chars)`);
  } catch (err) {
    logger.error('Telegram', 'Failed to send message', err instanceof Error ? err.message : err);
  }
}

export function isTelegramEnabled(): boolean {
  return bot !== null;
}
