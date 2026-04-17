/**
 * INTRACLAW — Slack webhook routes
 * Mounted at /webhooks/slack by server.ts when SLACK_* env vars are set.
 */
import { Router, Request, Response } from 'express';
import express from 'express';
import { getSlackAdapter } from './slack';

export const slackWebhookRouter = Router();

// Slack requires raw body for signature verification
slackWebhookRouter.use(express.raw({ type: 'application/json', limit: '2mb' }));
slackWebhookRouter.use(express.raw({ type: 'application/x-www-form-urlencoded', limit: '2mb' }));

function getHeader(req: Request, name: string): string {
  const v = req.headers[name.toLowerCase()];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

// POST /webhooks/slack/events — Events API
slackWebhookRouter.post('/events', async (req: Request, res: Response) => {
  const adapter = getSlackAdapter();
  if (!adapter) {
    res.status(503).json({ error: 'Slack adapter not active' });
    return;
  }

  const rawBody = (req.body as Buffer).toString('utf-8');
  const timestamp = getHeader(req, 'x-slack-request-timestamp');
  const signature = getHeader(req, 'x-slack-signature');

  if (!adapter.verifySignature(timestamp, rawBody, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // url_verification challenge (Slack sends once when URL is configured)
  if (payload.type === 'url_verification') {
    res.json({ challenge: payload.challenge });
    return;
  }

  if (payload.type === 'event_callback' && payload.event) {
    // ACK within 3s as Slack requires, then handle async
    res.status(200).json({ ok: true });
    adapter.handleEvent(payload.event).catch(err => {
      console.error('[Slack] handleEvent error', err);
    });
    return;
  }

  res.json({ ok: true });
});

// POST /webhooks/slack/commands — Slash commands (application/x-www-form-urlencoded)
slackWebhookRouter.post('/commands', async (req: Request, res: Response) => {
  const adapter = getSlackAdapter();
  if (!adapter) {
    res.status(503).json({ error: 'Slack adapter not active' });
    return;
  }

  const rawBody = (req.body as Buffer).toString('utf-8');
  const timestamp = getHeader(req, 'x-slack-request-timestamp');
  const signature = getHeader(req, 'x-slack-signature');

  if (!adapter.verifySignature(timestamp, rawBody, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const params = new URLSearchParams(rawBody);
  const cmd = {
    user_id: params.get('user_id') ?? '',
    channel_id: params.get('channel_id') ?? '',
    command: params.get('command') ?? '',
    text: params.get('text') ?? '',
  };

  const ackText = await adapter.handleSlashCommand(cmd);
  res.json({ response_type: 'ephemeral', text: ackText });
});
