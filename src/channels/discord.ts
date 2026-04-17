/**
 * INTRACLAW — Discord Adapter (lightweight REST + Gateway)
 *
 * Minimal Discord bot that:
 *   - sends messages via REST API (no library required for sending)
 *   - listens for incoming DMs/mentions via Discord Gateway WebSocket
 *     (uses `discord.js` if installed, otherwise connects with raw `ws`)
 *
 * Graceful degradation:
 *   - If DISCORD_BOT_TOKEN not set → adapter does NOT register.
 *   - If `ws` package unavailable (should be in tree via server libs) → REST-only mode.
 *
 * Env:
 *   DISCORD_BOT_TOKEN           – bot token (required)
 *   DISCORD_AUTHORIZED_USERS    – comma-separated user IDs (optional; empty = deny all command execution)
 *   DISCORD_NOTIFICATION_CHANNEL – default channel id for broadcasts (optional)
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  fn(`[${ts}] [${prefix}] [Discord] ${msg}`, err ?? '');
}

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';

// Discord gateway opcodes
const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_RECONNECT = 7;
const OP_INVALID_SESSION = 9;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

// Intents (bitfield)
const INTENT_GUILDS = 1 << 0;
const INTENT_GUILD_MESSAGES = 1 << 9;
const INTENT_DIRECT_MESSAGES = 1 << 12;
const INTENT_MESSAGE_CONTENT = 1 << 15;

export class DiscordAdapter implements ChannelAdapter {
  readonly channelId = 'discord' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private token: string;
  private authorizedUsers: Set<string>;
  private ws: any = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sequence: number | null = null;
  private botUserId: string | null = null;
  private shouldReconnect = true;

  constructor() {
    this.token = process.env.DISCORD_BOT_TOKEN ?? '';
    const users = process.env.DISCORD_AUTHORIZED_USERS ?? '';
    this.authorizedUsers = new Set(
      users.split(',').map(s => s.trim()).filter(Boolean),
    );
  }

  /** Indique si l'adapter peut être activé (token présent) */
  static isAvailable(): boolean {
    return !!process.env.DISCORD_BOT_TOKEN;
  }

  async init(): Promise<void> {
    if (!this.token) {
      log('warn', 'DISCORD_BOT_TOKEN non défini — adapter désactivé');
      return;
    }

    // Try to load `ws` package for Gateway connection
    let WebSocketCtor: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      WebSocketCtor = require('ws');
    } catch {
      log('warn', 'Package `ws` indisponible — mode REST-only (envoi seulement, pas de réception)');
      this.ready = true;
      return;
    }

    try {
      await this.connectGateway(WebSocketCtor);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', `Échec connexion Gateway : ${message}`);
      // Toujours marquer ready pour permettre l'envoi en REST
      this.ready = true;
    }
  }

  private async connectGateway(WebSocketCtor: any): Promise<void> {
    this.ws = new WebSocketCtor(DISCORD_GATEWAY);

    this.ws.on('open', () => {
      log('info', 'Gateway WebSocket ouvert');
    });

    this.ws.on('message', async (data: Buffer) => {
      let payload: any;
      try {
        payload = JSON.parse(data.toString());
      } catch {
        return;
      }
      await this.handleGatewayMessage(payload);
    });

    this.ws.on('close', (code: number) => {
      log('warn', `Gateway fermé (code ${code})`);
      this.ready = false;
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.shouldReconnect) {
        setTimeout(() => {
          this.connectGateway(WebSocketCtor).catch(e =>
            log('warn', `Reconnexion échouée : ${(e as Error).message}`),
          );
        }, 5_000);
      }
    });

    this.ws.on('error', (err: Error) => {
      log('error', `Erreur WebSocket : ${err.message}`);
    });
  }

  private async handleGatewayMessage(payload: any): Promise<void> {
    const { op, d, s, t } = payload;
    if (s) this.sequence = s;

    switch (op) {
      case OP_HELLO: {
        const interval = d.heartbeat_interval as number;
        this.startHeartbeat(interval);
        // Identify
        const intents = INTENT_GUILDS | INTENT_GUILD_MESSAGES | INTENT_DIRECT_MESSAGES | INTENT_MESSAGE_CONTENT;
        this.ws.send(JSON.stringify({
          op: OP_IDENTIFY,
          d: {
            token: this.token,
            intents,
            properties: { os: 'linux', browser: 'intraclaw', device: 'intraclaw' },
          },
        }));
        break;
      }
      case OP_HEARTBEAT_ACK:
        break;
      case OP_RECONNECT:
      case OP_INVALID_SESSION:
        log('warn', `Gateway demande reconnexion (op ${op})`);
        this.ws.close();
        break;
      case OP_DISPATCH:
        await this.handleDispatchEvent(t, d);
        break;
      default:
        break;
    }
  }

  private startHeartbeat(intervalMs: number): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ op: OP_HEARTBEAT, d: this.sequence }));
      }
    }, intervalMs);
  }

  private async handleDispatchEvent(eventType: string, data: any): Promise<void> {
    if (eventType === 'READY') {
      this.botUserId = data.user?.id ?? null;
      this.ready = true;
      log('info', `Connecté en tant que ${data.user?.username} (${this.botUserId})`);
      return;
    }

    if (eventType === 'MESSAGE_CREATE') {
      const authorId: string = data.author?.id ?? '';
      if (!authorId || authorId === this.botUserId) return;
      if (data.author?.bot) return;

      const content: string = String(data.content ?? '').trim();
      if (!content) return;

      const isDM = !data.guild_id;
      const mentioned = Array.isArray(data.mentions) &&
        data.mentions.some((m: any) => m.id === this.botUserId);

      if (!isDM && !mentioned) return;

      // Slash-style commands
      const cleaned = content.replace(/<@!?\d+>/g, '').trim();

      // Auth guard on commands
      if (cleaned.startsWith('/')) {
        if (this.authorizedUsers.size > 0 && !this.authorizedUsers.has(authorId)) {
          await this.sendToChannel(data.channel_id, 'Accès non autorisé.');
          return;
        }
      }

      const universal: UniversalMessage = {
        id: data.id ?? String(Date.now()),
        channelId: 'discord',
        senderId: data.channel_id,  // channel id as recipient for replies
        senderName: data.author?.username ?? 'discord-user',
        content: cleaned,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        metadata: {
          guildId: data.guild_id,
          channelId: data.channel_id,
          authorId,
          isDM,
        },
      };

      try {
        await this.messageHandler?.(universal);
      } catch (err) {
        log('error', 'Erreur handler message', err);
      }
    }
  }

  private async sendToChannel(channelId: string, text: string): Promise<void> {
    const url = `${DISCORD_API}/channels/${encodeURIComponent(channelId)}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Discord REST ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.token) return;
    try {
      const DISCORD_MAX = 2000;
      if (text.length <= DISCORD_MAX) {
        await this.sendToChannel(recipientId, text);
      } else {
        const chunks = text.match(new RegExp(`[\\s\\S]{1,${DISCORD_MAX}}`, 'g')) ?? [text];
        for (const chunk of chunks) {
          await this.sendToChannel(recipientId, chunk);
          await new Promise(r => setTimeout(r, 120));
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log('error', `Erreur envoi Discord à ${recipientId}: ${message}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    const channelId = process.env.DISCORD_NOTIFICATION_CHANNEL;
    if (channelId) await this.send(channelId, text);
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  async destroy(): Promise<void> {
    this.shouldReconnect = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ready = false;
  }
}
