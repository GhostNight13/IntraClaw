/**
 * INTRACLAW — Twilio WhatsApp + SMS webhook routes
 * Twilio posts application/x-www-form-urlencoded payloads.
 * Mounted at /webhooks/whatsapp and /webhooks/sms by server.ts.
 */
import { Router, Request, Response } from 'express';
import express from 'express';
import { getWhatsAppAdapter } from './whatsapp';
import { getSMSAdapter } from './sms';

export const twilioWebhookRouter = Router();

// Twilio sends form-urlencoded
twilioWebhookRouter.use(express.urlencoded({ extended: false }));

// POST /webhooks/whatsapp/incoming
twilioWebhookRouter.post('/whatsapp/incoming', async (req: Request, res: Response) => {
  const adapter = getWhatsAppAdapter();
  if (!adapter) {
    res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    return;
  }
  const form = (req.body ?? {}) as Record<string, string>;
  const twiml = await adapter.handleIncoming(form);
  res.type('text/xml').send(twiml);
});

// POST /webhooks/sms/incoming
twilioWebhookRouter.post('/sms/incoming', async (req: Request, res: Response) => {
  const adapter = getSMSAdapter();
  if (!adapter) {
    res.status(503).send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    return;
  }
  const form = (req.body ?? {}) as Record<string, string>;
  const twiml = await adapter.handleIncoming(form);
  res.type('text/xml').send(twiml);
});
