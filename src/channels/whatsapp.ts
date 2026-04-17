/**
 * INTRACLAW — WhatsApp Adapter via Twilio
 *
 * Sends and receives WhatsApp messages using Twilio's WhatsApp REST API.
 * No SDK dependency — uses basic auth + form-urlencoded POSTs.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID            – ACxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN             – your Twilio auth token
 *   TWILIO_WHATSAPP_FROM          – "whatsapp:+14155238886" (Twilio sandbox) or your number
 *
 * Optional:
 *   WHATSAPP_AUTHORIZED_NUMBERS   – comma-separated E.164 numbers (+14155551212)
 *                                   leave empty to allow anyone (NOT recommended)
 *
 * Webhook endpoint (mounted by server.ts via twilio-webhooks.ts):
 *   POST /webhooks/whatsapp/incoming   (Twilio posts x-www-form-urlencoded)
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  fn(`[${ts}] [${prefix}] [WhatsApp] ${msg}`, err ?? '');
}

let singleton: WhatsAppTwilioAdapter | null = null;
export function getWhatsAppAdapter(): WhatsAppTwilioAdapter | null {
  return singleton;
}

function normalizeWhatsApp(id: string): string {
  // Accept "+14155551212", "14155551212", "whatsapp:+14155551212"
  const trimmed = id.trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  const num = trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
  return `whatsapp:${num}`;
}

function stripWhatsApp(id: string): string {
  return id.startsWith('whatsapp:') ? id.slice('whatsapp:'.length) : id;
}

export class WhatsAppTwilioAdapter implements ChannelAdapter {
  readonly channelId = 'whatsapp' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private readonly sid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly authorized: Set<string>;

  constructor() {
    this.sid = process.env.TWILIO_ACCOUNT_SID ?? '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM ?? '';
    const list = process.env.WHATSAPP_AUTHORIZED_NUMBERS ?? '';
    this.authorized = new Set(
      list.split(',').map(s => s.trim()).filter(Boolean),
    );
  }

  static isAvailable(): boolean {
    return !!process.env.TWILIO_ACCOUNT_SID
      && !!process.env.TWILIO_AUTH_TOKEN
      && !!process.env.TWILIO_WHATSAPP_FROM;
  }

  async init(): Promise<void> {
    if (!this.sid || !this.authToken || !this.fromNumber) {
      log('warn', 'Config Twilio WhatsApp manquante — adapter désactivé');
      return;
    }
    this.ready = true;
    singleton = this;
    log('info', `Prêt (from=${this.fromNumber})`);
  }

  isAuthorized(senderPhone: string): boolean {
    if (this.authorized.size === 0) return false; // default deny
    const normalized = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`;
    return this.authorized.has(normalized) || this.authorized.has(senderPhone);
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.ready) return;
    const to = normalizeWhatsApp(recipientId);

    try {
      const MAX = 1500;
      const chunks = text.length <= MAX
        ? [text]
        : text.match(new RegExp(`[\\s\\S]{1,${MAX}}`, 'g')) ?? [text];

      for (const chunk of chunks) {
        await this.postMessage(to, chunk);
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err: unknown) {
      log('error', `Erreur envoi WhatsApp : ${(err as Error).message}`);
    }
  }

  private async postMessage(to: string, body: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.sid)}/Messages.json`;
    const form = new URLSearchParams();
    form.set('From', this.fromNumber);
    form.set('To', to);
    form.set('Body', body);

    const basic = Buffer.from(`${this.sid}:${this.authToken}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Twilio ${res.status}: ${txt.slice(0, 200)}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    // Broadcast to all authorized numbers (opt-in only)
    for (const num of this.authorized) {
      await this.send(num, text);
    }
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Called by webhook — receives parsed Twilio form.
   * Returns TwiML XML for immediate reply (empty if handled async).
   */
  async handleIncoming(form: Record<string, string>): Promise<string> {
    const rawFrom = form['From'] ?? '';
    const from = stripWhatsApp(rawFrom);
    const body = String(form['Body'] ?? '').trim();

    if (!from || !body) return '<?xml version="1.0" encoding="UTF-8"?><Response/>';

    if (!this.isAuthorized(from)) {
      log('warn', `WhatsApp non autorisé : ${from}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Accès non autorisé.</Message></Response>`;
    }

    const universal: UniversalMessage = {
      id: String(form['MessageSid'] ?? Date.now()),
      channelId: 'whatsapp',
      senderId: from,                       // used as recipient on reply
      senderName: String(form['ProfileName'] ?? from),
      content: body,
      timestamp: new Date(),
      metadata: {
        rawFrom,
        smsSid: form['SmsSid'],
        numMedia: form['NumMedia'],
      },
    };

    // Fire-and-forget — Twilio accepts reply via send() later
    this.messageHandler?.(universal).catch(err => log('error', 'handler', err));
    return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
  }
}
