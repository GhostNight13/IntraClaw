/**
 * BullMQ Worker — processes loop ticks for each user
 * Import and call startLoopWorker() once at app startup
 */
import { Worker, Job } from 'bullmq';
import { redisConnection, LOOP_QUEUE_NAME, LoopJobData } from './queue-client';
import { logger } from '../utils/logger';
import { checkQuota, QuotaExceededError } from '../billing/quota';

let _worker: Worker | null = null;

export function startLoopWorker(): Worker {
  if (_worker) return _worker;

  _worker = new Worker<LoopJobData>(
    LOOP_QUEUE_NAME,
    async (job: Job<LoopJobData>) => {
      const { userId } = job.data;
      logger.info('LoopWorker', `Processing tick for user ${userId}`);

      // Enforce per-plan quota BEFORE running the tick.
      try {
        checkQuota(userId, 'loop_tick');
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          logger.warn('LoopWorker', `Quota exceeded for ${userId}: ${err.used}/${err.limit} (${err.plan})`);
          // Don't retry — quota errors are intentional. Swallow so BullMQ marks job complete.
          return;
        }
        throw err;
      }

      try {
        // Dynamically import to avoid circular deps
        const { runLoopTick } = await import('../loop/autonomous-loop');
        await runLoopTick(userId);
      } catch (err) {
        logger.error('LoopWorker', `Tick failed for user ${userId}: ${err}`);
        throw err; // BullMQ will retry
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // Process up to 10 users simultaneously
    }
  );

  _worker.on('completed', (job) => {
    logger.info('LoopWorker', `Tick completed: ${job.data.userId}`);
  });

  _worker.on('failed', (job, err) => {
    logger.error('LoopWorker', `Tick failed: ${job?.data.userId} — ${err.message}`);
  });

  logger.info('LoopWorker', 'Worker started');
  return _worker;
}

export async function stopLoopWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
    logger.info('LoopWorker', 'Worker stopped');
  }
}
