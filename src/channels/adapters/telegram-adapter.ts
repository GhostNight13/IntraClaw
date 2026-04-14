/**
 * Adapter Telegram — wraps le canal Telegram existant
 * Compatible avec l'interface ChannelAdapter universelle
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from '../types';

// Forme minimale du module telegram.ts existant
interface TelegramModule {
  initTelegram?:         () => void | Promise<void>;
  startBot?:            () => void | Promise<void>;
  onIncomingMessage?:   (cb: (raw: RawTelegramMessage) => Promise<void>) => void;
  sendTelegramMessage?: (chatId: string | number, text: string) => Promise<void>;
  sendMessage?:         (chatId: string | number, text: string) => Promise<void>;
}

interface RawTelegramMessage {
  message_id?: number;
  id?:         number;
  chat?:       { id?: number };
  from?:       { id?: number; first_name?: string; username?: string };
  text?:       string;
  date?:       number;
}

export class TelegramAdapter implements ChannelAdapter {
  readonly channelId = 'telegram' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;

  // Lazy-load du module telegram existant
  private telegramModule: TelegramModule | null = null;

  async init(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.telegramModule = require('../telegram') as TelegramModule;

      // Le module telegram démarre son bot dans son propre init
      if (typeof this.telegramModule.initTelegram === 'function') {
        await this.telegramModule.initTelegram();
      } else if (typeof this.telegramModule.startBot === 'function') {
        await this.telegramModule.startBot();
      }

      // Intercepte les messages entrants pour les normaliser
      if (typeof this.telegramModule.onIncomingMessage === 'function') {
        this.telegramModule.onIncomingMessage(async (raw: RawTelegramMessage) => {
          const msg: UniversalMessage = {
            id:         String(raw.message_id ?? raw.id ?? Date.now()),
            channelId:  'telegram',
            senderId:   String(raw.chat?.id ?? raw.from?.id ?? ''),
            senderName: raw.from?.first_name ?? raw.from?.username ?? 'User',
            content:    raw.text ?? '',
            timestamp:  raw.date ? new Date(raw.date * 1000) : new Date(),
          };
          await this.messageHandler?.(msg);
        });
      }

      this.ready = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[TelegramAdapter] Init warning:', message);
      this.ready = false;
    }
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.telegramModule) return;
    if (typeof this.telegramModule.sendTelegramMessage === 'function') {
      await this.telegramModule.sendTelegramMessage(recipientId, text);
    } else if (typeof this.telegramModule.sendMessage === 'function') {
      await this.telegramModule.sendMessage(recipientId, text);
    }
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }
}
