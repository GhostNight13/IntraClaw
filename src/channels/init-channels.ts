/**
 * INTRACLAW — Channels Initializer
 * Démarre les adapters activés selon les variables .env
 *
 * Chaque adapter auto-détecte sa disponibilité (env vars) — aucun crash si
 * une dépendance optionnelle manque (discord.js, imapflow, nodemailer, …).
 */
import { registerAdapter, initGateway, setMessageHandler } from './gateway';
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [Channels] ${msg}`);
}

export type MessageHandler = (
  msg: UniversalMessage,
  respond: (text: string, opts?: SendOptions) => Promise<void>
) => Promise<void>;

/** Tracks adapters we've successfully registered */
const registered: string[] = [];

function tryRegister(name: string, load: () => ChannelAdapter | null): void {
  try {
    const adapter = load();
    if (!adapter) { log(`${name} SKIP (indisponible)`); return; }
    registerAdapter(adapter);
    registered.push(name);
    log(`${name} activé`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    log(`${name} SKIP: ${message}`);
  }
}

export function getRegisteredChannels(): string[] {
  return [...registered];
}

export async function initAllChannels(handler: MessageHandler): Promise<void> {
  initGateway();
  setMessageHandler(handler);

  // ── Telegram ────────────────────────────────────────
  if (process.env.TELEGRAM_BOT_TOKEN) {
    tryRegister('Telegram', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { TelegramAdapter } = require('./adapters/telegram-adapter');
      return new TelegramAdapter();
    });
  }

  // ── Discord (REST + Gateway, library-optional) ──────
  tryRegister('Discord', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DiscordAdapter } = require('./discord');
    if (!DiscordAdapter.isAvailable()) return null;
    return new DiscordAdapter();
  });

  // ── Slack (REST + Events webhook) ───────────────────
  tryRegister('Slack', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SlackAdapter } = require('./slack');
    if (!SlackAdapter.isAvailable()) return null;
    return new SlackAdapter();
  });

  // ── WhatsApp via Twilio ─────────────────────────────
  tryRegister('WhatsApp', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WhatsAppTwilioAdapter } = require('./whatsapp');
    if (!WhatsAppTwilioAdapter.isAvailable()) return null;
    return new WhatsAppTwilioAdapter();
  });

  // ── SMS via Twilio ──────────────────────────────────
  tryRegister('SMS', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SMSTwilioAdapter } = require('./sms');
    if (!SMSTwilioAdapter.isAvailable()) return null;
    return new SMSTwilioAdapter();
  });

  // ── Email (IMAP poll + SMTP send) ───────────────────
  tryRegister('Email', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { EmailChannelAdapter } = require('./email-channel');
    if (!EmailChannelAdapter.isAvailable()) return null;
    return new EmailChannelAdapter();
  });

  // ── Matrix (legacy heavy adapter, library-based) ────
  if (
    process.env.ENABLE_MATRIX === 'true' &&
    process.env.MATRIX_HOMESERVER &&
    process.env.MATRIX_USER_ID &&
    process.env.MATRIX_ACCESS_TOKEN
  ) {
    tryRegister('Matrix', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MatrixAdapter } = require('./adapters/matrix');
      return new MatrixAdapter(
        process.env.MATRIX_HOMESERVER!,
        process.env.MATRIX_USER_ID!,
        process.env.MATRIX_ACCESS_TOKEN!,
      );
    });
  }

  log(`Canaux actifs: ${registered.join(', ') || 'aucun'}`);
}
