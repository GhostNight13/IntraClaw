import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger } from './utils/logger';
import { loadMemory } from './memory/core';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { initTelegram } from './channels/telegram';
import { startServer } from './server';
import { startAutonomousLoop, stopAutonomousLoop } from './loop/autonomous-loop';
import { initMCPServers, closeMCPServers } from './mcp/mcp-client';
import { initVectorMemory } from './memory/vector-memory';

async function main(): Promise<void> {
  logger.info('Main', '=== IntraClaw starting (Autonomous Mode) ===');

  const memory = loadMemory();
  logger.info('Main', `Memory ready: ${memory.length} files loaded`);

  const ratioStatus = rateLimiter.getStatus();
  const costStatus  = costTracker.getStatus();
  logger.info('Main', 'Rate limits', ratioStatus);
  logger.info('Main', 'Cost status', costStatus);

  initTelegram();
  await initMCPServers();
  await initVectorMemory();
  startServer();

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
