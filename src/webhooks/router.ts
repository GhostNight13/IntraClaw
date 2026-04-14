import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { getWebhook, createWebhook, listWebhooks, deleteWebhook, getWebhookLogs, recordFire } from './registry';
import { runTask } from '../agents/coordinator';
import { logger } from '../utils/logger';

export const webhookRouter = Router();
export const apiWebhookRouter = Router();

// Raw body parser for HMAC verification
import express from 'express';
webhookRouter.use(express.raw({ type: 'application/json' }));

function verifySignature(rawBody: Buffer, secret: string, signature: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// POST /webhooks/:webhookId — inbound webhook trigger
webhookRouter.post('/:webhookId', async (req: Request, res: Response) => {
  const webhookId = req.params['webhookId'] as string;
  const webhook = getWebhook(webhookId);

  if (!webhook || !webhook.enabled) {
    res.status(404).json({ error: 'Webhook not found or disabled' });
    return;
  }

  const sigHeader = req.headers['x-intraclaw-signature'] ?? req.headers['x-hub-signature-256'] ?? '';
  const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
  const rawBody = req.body as Buffer;

  if (signature && !verifySignature(rawBody, webhook.secret, signature)) {
    logger.warn('Webhooks', `Invalid signature for webhook ${webhookId}`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  try {
    // Fire the configured task type
    if (webhook.eventType === 'agent.task') {
      const task = ((payload.task as string) ?? 'CUSTOM') as import('../types').AgentTask;
      await runTask(task);
    } else if (webhook.eventType === 'notification.send') {
      const { getDb } = await import('../db');
      getDb().prepare("INSERT INTO notifications (type, message) VALUES ('info', ?)").run(
        (payload.message as string) ?? 'Webhook triggered'
      );
    }

    recordFire(webhookId as string, 'success');
    res.json({ ok: true, webhookId, event: webhook.eventType });
    logger.info('Webhooks', `Fired: ${webhook.name} (${webhookId})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordFire(webhookId as string, 'error', msg);
    res.status(500).json({ error: msg });
  }
});

// ─── Management API routes ────────────────────────────────────────────────────

apiWebhookRouter.get('/', (_req: Request, res: Response) => {
  res.json(listWebhooks());
});

apiWebhookRouter.post('/', (req: Request, res: Response) => {
  const { name, eventType } = req.body as { name?: string; eventType?: string };
  if (!name) { res.status(400).json({ error: 'name required' }); return; }
  const result = createWebhook(name, (eventType ?? 'agent.task') as 'agent.task');
  res.status(201).json({
    webhook: result.webhook,
    secret: result.secret,
    note: 'Save the secret — it will not be shown again',
  });
});

apiWebhookRouter.delete('/:id', (req: Request, res: Response) => {
  deleteWebhook(req.params['id'] as string);
  res.json({ ok: true });
});

apiWebhookRouter.get('/:id/logs', (req: Request, res: Response) => {
  res.json(getWebhookLogs(req.params['id'] as string));
});
