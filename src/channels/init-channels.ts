/**
 * INTRACLAW — Channels Initializer
 * Démarre les adapters activés selon les variables .env
 */
import { registerAdapter, initGateway, setMessageHandler } from './gateway';
import type { UniversalMessage, SendOptions } from './types';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] 🌐 [Channels] ${msg}`);
}

export type MessageHandler = (
  msg: UniversalMessage,
  respond: (text: string, opts?: SendOptions) => Promise<void>
) => Promise<void>;

export async function initAllChannels(handler: MessageHandler): Promise<void> {
  // Init le gateway (charge les sessions autorisées)
  initGateway();

  // Définit le handler global
  setMessageHandler(handler);

  // ── Telegram ────────────────────────────────────────
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { TelegramAdapter } = require('./adapters/telegram-adapter');
      registerAdapter(new TelegramAdapter());
      log('Telegram activé');
    } catch (e: any) {
      log(`Telegram SKIP: ${e.message}`);
    }
  }

  // ── WhatsApp ────────────────────────────────────────
  if (process.env.ENABLE_WHATSAPP === 'true') {
    try {
      const { WhatsAppAdapter } = require('./adapters/whatsapp');
      registerAdapter(new WhatsAppAdapter());
      log('WhatsApp activé');
    } catch (e: any) {
      log(`WhatsApp SKIP: ${e.message}`);
    }
  }

  // ── Discord ─────────────────────────────────────────
  if (process.env.ENABLE_DISCORD === 'true' && process.env.DISCORD_TOKEN) {
    try {
      const { DiscordAdapter } = require('./adapters/discord');
      const guildIds = process.env.DISCORD_ALLOWED_GUILDS
        ? process.env.DISCORD_ALLOWED_GUILDS.split(',')
        : [];
      registerAdapter(new DiscordAdapter(process.env.DISCORD_TOKEN!, guildIds));
      log('Discord activé');
    } catch (e: any) {
      log(`Discord SKIP: ${e.message}`);
    }
  }

  // ── Slack ────────────────────────────────────────────
  if (
    process.env.ENABLE_SLACK === 'true' &&
    process.env.SLACK_BOT_TOKEN &&
    process.env.SLACK_SIGNING_SECRET &&
    process.env.SLACK_APP_TOKEN
  ) {
    try {
      const { SlackAdapter } = require('./adapters/slack');
      registerAdapter(new SlackAdapter(
        process.env.SLACK_BOT_TOKEN!,
        process.env.SLACK_SIGNING_SECRET!,
        process.env.SLACK_APP_TOKEN!,
      ));
      log('Slack activé');
    } catch (e: any) {
      log(`Slack SKIP: ${e.message}`);
    }
  }

  // ── Matrix ────────────────────────────────────────────
  if (
    process.env.ENABLE_MATRIX === 'true' &&
    process.env.MATRIX_HOMESERVER &&
    process.env.MATRIX_USER_ID &&
    process.env.MATRIX_ACCESS_TOKEN
  ) {
    try {
      const { MatrixAdapter } = require('./adapters/matrix');
      registerAdapter(new MatrixAdapter(
        process.env.MATRIX_HOMESERVER!,
        process.env.MATRIX_USER_ID!,
        process.env.MATRIX_ACCESS_TOKEN!,
      ));
      log('Matrix activé');
    } catch (e: any) {
      log(`Matrix SKIP: ${e.message}`);
    }
  }

  log(`Tous les canaux activés initialisés`);
}
