import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';
import { logger } from './utils/logger';
import { AgentTask } from './types';
import type { ScheduledJob } from './types';

const HEARTBEAT_PATH = path.resolve(process.cwd(), 'memory', 'HEARTBEAT.md');

// ─── Job registry ─────────────────────────────────────────────────────────────

const JOBS: ScheduledJob[] = [
  {
    name:           'Morning Brief',
    cronExpression: '0 7 * * 1-5',   // Mon-Fri 07:00
    task:           AgentTask.MORNING_BRIEF,
    enabled:        true,
  },
  {
    name:           'Prospecting',
    cronExpression: '0 8 * * 1-5',   // Mon-Fri 08:00
    task:           AgentTask.PROSPECTING,
    enabled:        true,
  },
  {
    name:           'Content',
    cronExpression: '0 9 * * 1-5',   // Mon-Fri 09:00
    task:           AgentTask.CONTENT,
    enabled:        true,
  },
  {
    name:           'Cold Emails',
    cronExpression: '0 10 * * 1-5',  // Mon-Fri 10:00
    task:           AgentTask.COLD_EMAIL,
    enabled:        true,
  },
  {
    name:           'Evening Report',
    cronExpression: '0 18 * * 1-5',  // Mon-Fri 18:00
    task:           AgentTask.EVENING_REPORT,
    enabled:        true,
  },
  {
    name:           'Maintenance',
    cronExpression: '0 3 * * 0',     // Sunday 03:00
    task:           AgentTask.MAINTENANCE,
    enabled:        true,
  },
  {
    name:           'REM Cycle',
    cronExpression: '0 3 * * *',     // Every night at 03:00
    task:           AgentTask.REM_DREAM,
    enabled:        true,
  },
];

// ─── Task handlers ────────────────────────────────────────────────────────────

type TaskHandler = (task: AgentTask) => Promise<void>;
let _taskHandler: TaskHandler | null = null;

export function registerTaskHandler(handler: TaskHandler): void {
  _taskHandler = handler;
  logger.info('Scheduler', 'Task handler registered');
}

async function runTask(job: ScheduledJob): Promise<void> {
  job.lastRunAt = new Date().toISOString();
  logger.info('Scheduler', `Running job: ${job.name}`, { task: job.task });

  if (!_taskHandler) {
    logger.warn('Scheduler', 'No task handler registered — skipping execution');
    return;
  }

  try {
    await _taskHandler(job.task);
    logger.info('Scheduler', `Job completed: ${job.name}`);
  } catch (err) {
    logger.error('Scheduler', `Job failed: ${job.name}`, err instanceof Error ? err.message : err);
  }
}

// ─── HEARTBEAT.md reader ──────────────────────────────────────────────────────

function parseHeartbeat(): string {
  try {
    if (!fs.existsSync(HEARTBEAT_PATH)) {
      logger.warn('Scheduler', 'HEARTBEAT.md not found — using default schedule');
      return '';
    }
    return fs.readFileSync(HEARTBEAT_PATH, 'utf8');
  } catch (err) {
    logger.error('Scheduler', 'Failed to read HEARTBEAT.md', err);
    return '';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let _scheduledTasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  const heartbeat = parseHeartbeat();
  if (heartbeat) {
    logger.info('Scheduler', 'HEARTBEAT.md loaded', {
      length: heartbeat.length,
    });
  }

  // Stop existing tasks
  for (const t of _scheduledTasks) t.stop();
  _scheduledTasks = [];

  for (const job of JOBS) {
    if (!job.enabled) {
      logger.info('Scheduler', `Skipping disabled job: ${job.name}`);
      continue;
    }

    if (!cron.validate(job.cronExpression)) {
      logger.error('Scheduler', `Invalid cron expression for ${job.name}: ${job.cronExpression}`);
      continue;
    }

    const task = cron.schedule(job.cronExpression, () => {
      runTask(job).catch(err => {
        logger.error('Scheduler', `Unhandled error in ${job.name}`, err);
      });
    }, { timezone: 'Europe/Brussels' });

    _scheduledTasks.push(task);
    logger.info('Scheduler', `Scheduled: ${job.name} [${job.cronExpression}]`);
  }

  logger.info('Scheduler', `${_scheduledTasks.length} jobs scheduled (Europe/Brussels timezone)`);
}

export function stopScheduler(): void {
  for (const t of _scheduledTasks) t.stop();
  _scheduledTasks = [];
  logger.info('Scheduler', 'All jobs stopped');
}

export function getJobs(): ScheduledJob[] {
  return JOBS;
}

/**
 * Manually trigger a task by name (useful for testing / on-demand runs).
 */
export async function triggerJob(taskName: AgentTask): Promise<void> {
  const job = JOBS.find(j => j.task === taskName);
  if (!job) {
    throw new Error(`No job found for task: ${taskName}`);
  }
  await runTask(job);
}
