/**
 * INTRACLAW — Discord Adapter
 * Utilise discord.js pour créer un bot Discord.
 * Répond aux DMs et aux mentions directes dans les serveurs.
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from '../types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown) {
  const prefix = { info: '✅', warn: '⚠️ ', error: '❌' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [Discord] ${msg}`, err ?? '');
}

export class DiscordAdapter implements ChannelAdapter {
  readonly channelId = 'discord' as const;
  private client: any = null;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private token: string;
  private allowedGuildIds: string[];

  constructor(token: string, allowedGuildIds: string[] = []) {
    this.token           = token;
    this.allowedGuildIds = allowedGuildIds;
  }

  async init(): Promise<void> {
    if (!this.token) {
      log('warn', 'DISCORD_TOKEN non défini — adapter désactivé');
      return;
    }

    let discord: any;
    try {
      discord = require('discord.js');
    } catch (err: any) {
      log('warn', `Package discord.js non installé : ${err.message}`);
      return;
    }

    const { Client, GatewayIntentBits, Partials } = discord;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    // ── Events ────────────────────────────────────────

    this.client.once('ready', (client: any) => {
      this.ready = true;
      log('info', `✅ Connecté en tant que ${client.user.tag}`);
    });

    this.client.on('error', (err: Error) => {
      log('error', `Erreur client Discord`, err);
    });

    this.client.on('messageCreate', async (message: any) => {
      // Ignore les bots
      if (message.author.bot) return;

      const isDM      = !message.guild;
      const isMention = message.mentions.has(this.client.user);

      // Accepte : DMs directs, ou messages avec mention @IntraClaw
      if (!isDM && !isMention) return;

      // Filtre les serveurs si whitelist définie
      if (!isDM && this.allowedGuildIds.length > 0) {
        if (!this.allowedGuildIds.includes(message.guild.id)) return;
      }

      // Nettoie le contenu (enlève la mention)
      let content = message.cleanContent;
      if (isMention) {
        content = content.replace(/<@!?\d+>/g, '').trim();
      }

      if (!content && !message.attachments.size) return;

      // Indique "en train d'écrire" pendant le traitement
      try { await message.channel.sendTyping(); } catch { /* ignore */ }

      const universal: UniversalMessage = {
        id:        message.id,
        channelId: 'discord',
        senderId:  message.author.id,
        senderName: message.author.username,
        content,
        timestamp: message.createdAt,
        metadata: {
          guildId:   message.guild?.id,
          channelId: message.channel.id,
          isDM,
        },
      };

      // Pièces jointes
      if (message.attachments.size > 0) {
        universal.media = Array.from(message.attachments.values()).map((att: any) => ({
          type:     att.contentType?.startsWith('image') ? 'image' : 'file' as any,
          url:      att.url,
          filename: att.name,
          size:     att.size,
          mimeType: att.contentType,
        }));
      }

      try {
        await this.messageHandler?.(universal);
      } catch (err) {
        log('error', 'Erreur handler message', err);
        await message.reply('❌ Une erreur s\'est produite.');
      }
    });

    log('info', 'Connexion à Discord...');
    await this.client.login(this.token);
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.client || !this.ready) {
      log('warn', 'Impossible d\'envoyer : client non prêt');
      return;
    }

    try {
      const DISCORD_MAX = 2000;

      // Récupère le canal ou l'utilisateur
      let target: any;
      try {
        // Essaie d'abord comme channel (pour les DMs en cours)
        target = await this.client.channels.fetch(recipientId);
      } catch {
        // Fallback : essaie comme user (DM)
        const user = await this.client.users.fetch(recipientId);
        target = await user.createDM();
      }

      // Découpe si nécessaire (limite Discord 2000 chars)
      if (text.length <= DISCORD_MAX) {
        await target.send(text);
      } else {
        const chunks = text.match(new RegExp(`[\\s\\S]{1,${DISCORD_MAX}}`, 'g')) ?? [text];
        for (const chunk of chunks) {
          await target.send(chunk);
          // Petite pause entre les messages
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } catch (err: any) {
      log('error', `Erreur envoi Discord à ${recipientId}: ${err.message}`);
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
    await this.client?.destroy();
    this.ready = false;
  }
}
