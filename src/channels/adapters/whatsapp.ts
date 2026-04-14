/**
 * INTRACLAW — WhatsApp Adapter
 * Utilise whatsapp-web.js + Puppeteer pour se connecter via QR code.
 * Session persistée dans data/whatsapp-session/
 */
import * as path from 'path';
import type { ChannelAdapter, UniversalMessage, SendOptions } from '../types';

// Lazy imports pour éviter les erreurs si non installé
let WAClient: any;
let LocalAuth: any;
let qrcode: any;

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown) {
  const prefix = { info: '✅', warn: '⚠️ ', error: '❌' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [WhatsApp] ${msg}`, err ?? '');
}

export class WhatsAppAdapter implements ChannelAdapter {
  readonly channelId = 'whatsapp' as const;
  private client: any = null;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;

  async init(): Promise<void> {
    try {
      // Import dynamique (évite crash si package absent)
      const wwjs = require('whatsapp-web.js');
      WAClient   = wwjs.Client;
      LocalAuth  = wwjs.LocalAuth;
      qrcode     = require('qrcode-terminal');
    } catch (err: any) {
      log('warn', `Package whatsapp-web.js non installé : ${err.message}`);
      return;
    }

    const sessionPath = path.join(process.cwd(), 'data', 'whatsapp-session');

    this.client = new WAClient({
      authStrategy: new LocalAuth({ dataPath: sessionPath }),
      puppeteer: {
        headless:    true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
    });

    // ── Events ────────────────────────────────────────

    this.client.on('qr', (qr: string) => {
      console.log('\n');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║  📱 WHATSAPP — Scanne ce QR code        ║');
      console.log('╚══════════════════════════════════════════╝');
      qrcode.generate(qr, { small: true });
      console.log('Ouvre WhatsApp → Appareils connectés → Connecter un appareil\n');
    });

    this.client.on('ready', () => {
      this.ready = true;
      log('info', '✅ WhatsApp connecté !');
    });

    this.client.on('auth_failure', (msg: string) => {
      log('error', `Échec authentification : ${msg}`);
      this.ready = false;
    });

    this.client.on('disconnected', (reason: string) => {
      log('warn', `Déconnecté : ${reason}`);
      this.ready = false;
      // Tentative de reconnexion après 30 secondes
      setTimeout(() => {
        log('info', 'Tentative de reconnexion...');
        this.client?.initialize().catch((e: Error) =>
          log('warn', `Reconnexion échouée : ${e.message}`)
        );
      }, 30_000);
    });

    this.client.on('message', async (msg: any) => {
      // Ignorer les messages de groupe sauf si mentionné (configurable)
      if (msg.isGroupMsg || msg.from.endsWith('@g.us')) return;

      // Ignorer les messages propres (envoyés par le bot)
      if (msg.fromMe) return;

      try {
        const contact = await msg.getContact();
        const universal: UniversalMessage = {
          id:          msg.id._serialized,
          channelId:   'whatsapp',
          senderId:    msg.from,                              // ex: "32499123456@c.us"
          senderName:  contact.pushname || contact.name || msg.from.split('@')[0],
          content:     msg.body || '',
          timestamp:   new Date(msg.timestamp * 1000),
          metadata: {
            hasMedia: msg.hasMedia,
            type:     msg.type,
          },
        };

        // Gestion des médias
        if (msg.hasMedia) {
          try {
            const media = await msg.downloadMedia();
            universal.media = [{
              type:     (msg.type === 'image' ? 'image' : msg.type === 'audio' ? 'audio' : 'file') as any,
              url:      `data:${media.mimetype};base64,${media.data}`,
              mimeType: media.mimetype,
              filename: media.filename,
            }];
          } catch {
            // Ignore les erreurs de téléchargement
          }
        }

        await this.messageHandler?.(universal);
      } catch (err) {
        log('error', 'Erreur traitement message', err);
      }
    });

    // Démarrage du client
    log('info', 'Initialisation du client WhatsApp...');
    await this.client.initialize();
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.client || !this.ready) {
      log('warn', `Impossible d'envoyer : client non prêt`);
      return;
    }

    try {
      // WhatsApp limite à ~65K chars, on découpe à 4096 pour la lisibilité
      const MAX = 4096;
      const chunks = text.length > MAX
        ? text.match(new RegExp(`.{1,${MAX}}`, 'gs')) ?? [text]
        : [text];

      for (const chunk of chunks) {
        await this.client.sendMessage(recipientId, chunk);
      }
    } catch (err: any) {
      log('error', `Erreur envoi à ${recipientId}: ${err.message}`);
    }
  }

  /** Broadcast vers le premier contact autorisé (pour les notifications) */
  async broadcast(text: string): Promise<void> {
    // Récupère le chat ID configuré dans .env si défini
    const chatId = process.env.WHATSAPP_OWNER_ID;
    if (chatId) await this.send(chatId, text);
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.ready = false;
    }
  }
}
