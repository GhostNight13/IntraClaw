/**
 * INTRACLAW — Slack Adapter (REST + Events API webhooks)
 *
 * Minimal Slack bot — no library dependency. Posts messages via `chat.postMessage`
 * (Slack Web API) and receives events via Express webhook mounted by the gateway.
 *
 * Required env:
 *   SLACK_BOT_TOKEN          – xoxb-…
 *   SLACK_SIGNING_SECRET     – used to verify incoming Events API requests
 *
 * Optional:
 *   SLACK_AUTHORIZED_USERS          – comma-separated Slack user IDs
 *   SLACK_NOTIFICATION_CHANNEL      – default channel for broadcasts
 *
 * Webhook endpoints exposed by `slack-webhooks.ts` (mounted in server.ts):
 *   POST /webhooks/slack/events
 *   POST /webhooks/slack/commands
 */
import * as crypto from 'crypto';
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  fn(`[${ts}] [${prefix}] [Slack] ${msg}`, err ?? '');
}

const SLACK_API = 'https://slack.com/api';

/** Singleton accessor so webhook handlers can find the adapter */
let singleton: SlackAdapter | null = null;
export function getSlackAdapter(): SlackAdapter | null {
  return singleton;
}

export class SlackAdapter implements ChannelAdapter {
  readonly channelId = 'slack' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private readonly botToken: string;
  private readonly signingSecret: string;
  private readonly authorizedUsers: Set<string>;
  private botUserId: string | null = null;

  constructor() {
    this.botToken = process.env.SLACK_BOT_TOKEN ?? '';
    this.signingSecret = process.env.SLACK_SIGNING_SECRET ?? '';
    const users = process.env.SLACK_AUTHORIZED_USERS ?? '';
    this.authorizedUsers = new Set(
      users.split(',').map(s => s.trim()).filter(Boolean),
    );
  }

  static isAvailable(): boolean {
    return !!process.env.SLACK_BOT_TOKEN && !!process.env.SLACK_SIGNING_SECRET;
  }

  async init(): Promise<void> {
    if (!this.botToken || !this.signingSecret) {
      log('warn', 'SLACK_BOT_TOKEN ou SLACK_SIGNING_SECRET manquant — adapter désactivé');
      return;
    }

    // Test auth to get bot user id
    try {
      const res = await fetch(`${SLACK_API}/auth.test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.botToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      const data = await res.json() as { ok: boolean; user_id?: string; error?: string };
      if (!data.ok) {
        log('warn', `auth.test a échoué : ${data.error}`);
        return;
      }
      this.botUserId = data.user_id ?? null;
      this.ready = true;
      singleton = this;
      log('info', `Connecté — bot user ${this.botUserId ?? 'unknown'}`);
    } catch (err: unknown) {
      log('warn', `Impossible de vérifier le token : ${(err as Error).message}`);
    }
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.botToken || !this.ready) return;
    try {
      const SLACK_MAX = 4000;
      const chunks = text.length <= SLACK_MAX
        ? [text]
        : text.match(new RegExp(`[\\s\\S]{1,${SLACK_MAX}}`, 'g')) ?? [text];

      for (const chunk of chunks) {
        const res = await fetch(`${SLACK_API}/chat.postMessage`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.botToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({ channel: recipientId, text: chunk, mrkdwn: true }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) {
          log('error', `chat.postMessage ${recipientId}: ${data.error ?? 'unknown'}`);
          break;
        }
        await new Promise(r => setTimeout(r, 120));
      }
    } catch (err: unknown) {
      log('error', `Erreur envoi Slack : ${(err as Error).message}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    const channelId = process.env.SLACK_NOTIFICATION_CHANNEL;
    if (channelId) await this.send(channelId, text);
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  // ── Webhook helpers (called by slack-webhooks.ts) ──────────────────────────

  /** Vérifie la signature Slack v0 */
  verifySignature(timestamp: string, rawBody: string, signature: string): boolean {
    if (!timestamp || !signature || !this.signingSecret) return false;

    // Reject stale requests (>5 min)
    const ts = parseInt(timestamp, 10);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

    const base = `v0:${timestamp}:${rawBody}`;
    const expected = 'v0=' + crypto
      .createHmac('sha256', this.signingSecret)
      .update(base)
      .digest('hex');

    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  isAuthorized(userId: string): boolean {
    // Default-deny: no SLACK_AUTHORIZED_USERS configured = channel locked.
    if (this.authorizedUsers.size === 0) return false;
    return this.authorizedUsers.has(userId);
  }

  async handleEvent(evt: any): Promise<void> {
    if (!evt || evt.type !== 'message') return;
    if (evt.subtype) return; // ignore edits/deletes/bot_messages
    if (!evt.user || evt.user === this.botUserId) return;

    // Auth guard
    if (!this.isAuthorized(evt.user)) {
      await this.send(evt.channel, 'Accès non autorisé.');
      return;
    }

    const universal: UniversalMessage = {
      id: String(evt.ts ?? Date.now()),
      channelId: 'slack',
      senderId: evt.channel,  // channel id — replies go there
      senderName: evt.user,
      content: String(evt.text ?? '').trim(),
      timestamp: evt.ts ? new Date(Number(evt.ts) * 1000) : new Date(),
      metadata: {
        channel: evt.channel,
        userId: evt.user,
        team: evt.team,
        threadTs: evt.thread_ts,
      },
    };

    await this.messageHandler?.(universal);
  }

  async handleSlashCommand(cmd: { user_id: string; channel_id: string; command: string; text: string }): Promise<string> {
    if (!this.isAuthorized(cmd.user_id)) return 'Accès non autorisé.';

    const universal: UniversalMessage = {
      id: String(Date.now()),
      channelId: 'slack',
      senderId: cmd.channel_id,
      senderName: cmd.user_id,
      content: `${cmd.command} ${cmd.text}`.trim(),
      timestamp: new Date(),
      metadata: { channel: cmd.channel_id, userId: cmd.user_id, isSlashCommand: true },
    };

    // Fire-and-forget — Slack requires reply in 3s; we'll respond inline quickly
    this.messageHandler?.(universal).catch(err => log('error', 'handler slash', err));
    return 'Commande reçue, je traite...';
  }
}
