import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env before anything else
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger } from './utils/logger';
import { loadMemory, buildSystemPrompt } from './memory/core';
import { startScheduler, registerTaskHandler } from './scheduler';
import { addMessage } from './memory/buffer';
import { rateLimiter } from './utils/rate-limiter';
import { costTracker } from './utils/cost-tracker';
import { AgentTask } from './types';
import { runTask } from './agents/coordinator';
import { initTelegram } from './channels/telegram';
import { startServer } from './server';

// ─── Task handler (delegated to coordinator) ──────────────────────────────────

async function handleTask(task: AgentTask): Promise<void> {
  logger.info('Main', `Dispatching task: ${task}`);
  const result = await runTask(task);

  addMessage(
    'assistant',
    result.success
      ? `Task ${task} completed in ${result.durationMs}ms via ${result.model}`
      : `Task ${task} failed: ${result.error}`,
    task
  );

  if (!result.success) {
    logger.error('Main', `Task ${task} failed`, result.error);
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  logger.info('Main', '=== IntraClaw starting ===');

  // 1. Load memory files
  const memory = loadMemory();
  logger.info('Main', `Memory ready: ${memory.length} files loaded`);

  // 2. Print rate limit + cost status
  const ratioStatus = rateLimiter.getStatus();
  const costStatus  = costTracker.getStatus();
  logger.info('Main', 'Rate limits', ratioStatus);
  logger.info('Main', 'Cost status', costStatus);

  // 3. Register task handler and start scheduler
  registerTaskHandler(handleTask);
  startScheduler();

  // 4. Init Telegram channel (no-op if token not set)
  initTelegram();

  // 5. Start Express API server (port 3001)
  startServer();

  logger.info('Main', 'IntraClaw started — scheduler active (Europe/Brussels)');
  logger.info('Main', 'Waiting for scheduled tasks... Press Ctrl+C to stop.');

  // 6. Graceful shutdown
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function shutdown(signal: string): void {
  logger.info('Main', `Received ${signal} — shutting down gracefully`);
  const { stopScheduler } = require('./scheduler');
  stopScheduler();
  process.exit(0);
}

main().catch(err => {
  logger.error('Main', 'Fatal startup error', err instanceof Error ? err.message : err);
  process.exit(1);
});
