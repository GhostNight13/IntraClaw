/**
 * INTRACLAW — Slack Adapter
 * Utilise @slack/bolt avec Socket Mode (pas de port HTTP exposé requis).
 * Répond aux DMs et aux mentions dans les channels.
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from '../types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown) {
  const prefix = { info: '✅', warn: '⚠️ ', error: '❌' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [Slack] ${msg}`, err ?? '');
}

export class SlackAdapter implements ChannelAdapter {
  readonly channelId = 'slack' as const;
  private app: any = null;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private botUserId: string = '';

  constructor(
    private readonly botToken: string,
    private readonly signingSecret: string,
    private readonly appToken: string,
  ) {}

  async init(): Promise<void> {
    if (!this.botToken || !this.signingSecret || !this.appToken) {
      log('warn', 'Variables Slack manquantes (SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN) — adapter désactivé');
      return;
    }

    let SlackModule: any;
    try {
      SlackModule = require('@slack/bolt');
    } catch (err: any) {
      log('warn', `Package @slack/bolt non installé : ${err.message}`);
      return;
    }

    const { App, LogLevel } = SlackModule;

    try {
      this.app = new App({
        token:         this.botToken,
        signingSecret: this.signingSecret,
        socketMode:    true,
        appToken:      this.appToken,
        logLevel:      LogLevel.ERROR,  // Réduit le bruit dans les logs
      });

      // Récupère l'ID du bot pour éviter de répondre à soi-même
      const authTest = await this.app.client.auth.test({ token: this.botToken });
      this.botUserId = authTest.user_id || '';

      // ── Écoute les messages ────────────────────────────────
      this.app.message(async ({ message, say, client }: any) => {
        // Ignore les sous-types (edits, deletes, etc.)
        if (message.subtype) return;
        // Ignore les messages du bot lui-même
        if (message.user === this.botUserId) return;

        const text: string = message.text || '';

        // Récupère le nom de l'utilisateur
        let senderName = message.user || 'Unknown';
        try {
          const userInfo = await client.users.info({ user: message.user });
          senderName = userInfo.user?.real_name || userInfo.user?.name || message.user;
        } catch { /* ignore */ }

        // Affiche "en train d'écrire"
        try {
          await client.conversations.mark({ channel: message.channel, ts: message.ts });
        } catch { /* ignore */ }

        const universal: UniversalMessage = {
          id:        message.ts,
          channelId: 'slack',
          senderId:  message.user,
          senderName,
          content:   text,
          timestamp: new Date(Number(message.ts) * 1000),
          metadata: {
            channel:    message.channel,
            threadTs:   message.thread_ts,
            isIM:       message.channel_type === 'im',
          },
        };

        await this.messageHandler?.(universal);
      });

      // ── Écoute les mentions app_mention ────────────────────
      this.app.event('app_mention', async ({ event, say }: any) => {
        const text = (event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();

        const universal: UniversalMessage = {
          id:        event.ts,
          channelId: 'slack',
          senderId:  event.user,
          senderName: event.user,
          content:   text,
          timestamp: new Date(Number(event.ts) * 1000),
          metadata: {
            channel:  event.channel,
            isMention: true,
          },
        };

        await this.messageHandler?.(universal);
      });

      // Démarre en Socket Mode (pas besoin d'un port HTTP public)
      await this.app.start();
      this.ready = true;
      log('info', `✅ Connecté à Slack (bot: ${authTest.user || 'unknown'})`);

    } catch (err: any) {
      log('error', `Échec connexion Slack : ${err.message}`, err);
    }
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.app || !this.ready) {
      log('warn', 'Impossible d\'envoyer : app Slack non prête');
      return;
    }

    try {
      const SLACK_MAX = 4000;

      if (text.length <= SLACK_MAX) {
        await this.app.client.chat.postMessage({
          token:   this.botToken,
          channel: recipientId,
          text,
          mrkdwn:  true,
        });
      } else {
        // Découpe en blocs
        const chunks = text.match(new RegExp(`[\\s\\S]{1,${SLACK_MAX}}`, 'g')) ?? [text];
        for (const chunk of chunks) {
          await this.app.client.chat.postMessage({
            token:   this.botToken,
            channel: recipientId,
            text:    chunk,
            mrkdwn:  true,
          });
          await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (err: any) {
      log('error', `Erreur envoi Slack à ${recipientId}: ${err.message}`);
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

  async destroy(): Promise<void> {
    await this.app?.stop();
    this.ready = false;
  }
}
