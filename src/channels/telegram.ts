import { Bot, Context } from 'grammy';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';
import { costTracker } from '../utils/cost-tracker';
import { getProspectsByStatus } from '../tools/notion';
import { getEmailsSentToday } from '../agents/cold-email';
import { runTask } from '../agents/coordinator';
import { resolveBlockedTask, getPendingBlockedTasks } from '../agents/autonomous-runner';
import { getPendingProposals, approveProposal, rejectProposal, applyProposal } from '../agents/self-improvement';
import { stopScheduler, startScheduler, getJobs } from '../scheduler';
import { ProspectStatus, AgentTask } from '../types';

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
    await ctx.reply('⛔ Non autorisé.');
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

async function handleText(ctx: Context): Promise<void> {
  const text = ctx.message?.text ?? '';
  if (!text || text.startsWith('/')) return;

  logger.info('Telegram', `Message from user: "${text.slice(0, 80)}"`);
  await ctx.reply('⏳ IntraClaw réfléchit...');

  try {
    // Route free-text to coordinator as morning brief (ad-hoc)
    // A dedicated NL router could be added later
    const result = await runTask(AgentTask.MORNING_BRIEF);
    if (result.success && result.data && typeof result.data === 'object' && 'brief' in result.data) {
      const brief = (result.data as { brief: string }).brief;
      // Telegram message limit: 4096 chars
      const truncated = brief.slice(0, 4000);
      await ctx.reply(truncated);
    } else {
      await ctx.reply('✅ Tâche executée. Check les logs pour le détail.');
    }
  } catch (err) {
    await ctx.reply(`❌ Erreur: ${err instanceof Error ? err.message : String(err)}`);
  }
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
      '/reject <id> — Rejeter une proposition',
      { parse_mode: 'Markdown' }
    );
  });

  bot.command('status',    async ctx => { if (await guardUser(ctx)) await handleStatus(ctx); });
  bot.command('report',    async ctx => { if (await guardUser(ctx)) await handleReport(ctx); });
  bot.command('prospects', async ctx => { if (await guardUser(ctx)) await handleProspects(ctx); });
  bot.command('pause',     async ctx => { if (await guardUser(ctx)) await handlePause(ctx); });
  bot.command('resume',    async ctx => { if (await guardUser(ctx)) await handleResume(ctx); });
  bot.command('blocked',   async ctx => { if (await guardUser(ctx)) await handleBlocked(ctx); });
  bot.command('unblock',   async ctx => { if (await guardUser(ctx)) await handleUnblock(ctx); });
  bot.command('proposals', async ctx => { if (await guardUser(ctx)) await handleProposals(ctx); });
  bot.command('approve',   async ctx => { if (await guardUser(ctx)) await handleApprove(ctx); });
  bot.command('reject',    async ctx => { if (await guardUser(ctx)) await handleReject(ctx); });

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
