/**
 * BullMQ Queue Client — shared Redis connection for producer and worker
 */
import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Shared Redis connection (reused across queue/worker)
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const LOOP_QUEUE_NAME = 'intraclaw:user-loops';

// Queue instance (producer side)
export const loopQueue = new Queue(LOOP_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
  },
});

/**
 * Schedule a recurring loop tick for a user.
 * Idempotent — safe to call multiple times for same userId.
 */
export async function scheduleUserLoop(userId: string): Promise<void> {
  const jobId = `loop-${userId}`;
  // Remove existing job first (idempotent)
  const existing = await loopQueue.getJob(jobId);
  if (existing) await existing.remove();

  await loopQueue.add(
    'tick',
    { userId },
    {
      jobId,
      repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
    }
  );
}

/**
 * Cancel a user's loop.
 */
export async function cancelUserLoop(userId: string): Promise<void> {
  const jobId = `loop-${userId}`;
  const job = await loopQueue.getJob(jobId);
  if (job) await job.remove();
}

export type LoopJobData = { userId: string };
