import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger } from './utils/logger';
import { initI18n } from './i18n';
import { loadMemory } from './memory/core';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { initTelegram } from './channels/telegram';
import { startServer } from './server';
import { startAutonomousLoop, stopAutonomousLoop } from './loop/autonomous-loop';
import { initMCPServers, closeMCPServers } from './mcp/mcp-client';
import { initVectorMemory } from './memory/vector-memory';
import { initAllChannels } from './channels/init-channels';
import { getConversationHistory, appendToHistory } from './channels/session-store';
import { executeUniversalTask } from './executor/universal-executor';
import { initCalendar } from './tools/calendar';
import { initHomeAssistant } from './tools/smart-home';
import { loadAllPlugins } from './plugins';
import { initWorkflowScheduler } from './workflows';

async function main(): Promise<void> {
  logger.info('Main', '=== IntraClaw starting (Autonomous Mode) ===');

  await initI18n();
  logger.info('Main', 'i18n ready (10 languages)');

  const memory = loadMemory();
  logger.info('Main', `Memory ready: ${memory.length} files loaded`);

  const ratioStatus = rateLimiter.getStatus();
  const costStatus  = costTracker.getStatus();
  logger.info('Main', 'Rate limits', ratioStatus);
  logger.info('Main', 'Cost status', costStatus);

  initTelegram();
  await initMCPServers();
  await initVectorMemory();
  initCalendar();
  await initHomeAssistant();
  await loadAllPlugins();
  startServer();

  await initWorkflowScheduler();

  // ── Universal Channels Gateway ────────────────────────────────────────────
  await initAllChannels(async (msg, respond) => {
    try {
      await respond('⏳ Traitement en cours...');

      const history = getConversationHistory(msg.channelId, msg.senderId, 8);

      let enrichedRequest = msg.content;
      if (history.length > 0) {
        const histCtx = history
          .map(h => `${h.role === 'user' ? '👤' : '🤖'}: ${h.content}`)
          .join('\n');
        enrichedRequest = `[Contexte précédent]\n${histCtx}\n\n[Nouveau message]\n${msg.content}`;
      }

      const result = await executeUniversalTask(enrichedRequest);

      const responseText = result.finalOutput || '✅ Tâche complétée.';

      appendToHistory(msg.channelId, msg.senderId, {
        role: 'assistant',
        content: responseText,
      });

      await respond(responseText);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await respond(`❌ Erreur : ${message}`);
    }
  });

  logger.info('Main', 'Universal channels gateway ready');

  await startAutonomousLoop();

  logger.info('Main', 'IntraClaw autonomous — perceiving, deciding, acting. Press Ctrl+C to stop.');

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function shutdown(signal: string): void {
  logger.info('Main', `Received ${signal} — shutting down`);
  stopAutonomousLoop();
  closeMCPServers().catch(() => {}).finally(() => process.exit(0));
}

main().catch(err => {
  logger.error('Main', 'Fatal startup error', err instanceof Error ? err.message : err);
  process.exit(1);
});
