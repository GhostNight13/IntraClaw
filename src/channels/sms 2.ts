/**
 * INTRACLAW — SMS Adapter via Twilio
 *
 * Same pattern as WhatsApp adapter but uses Twilio SMS.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_SMS_FROM              – "+14155551212"
 *
 * Optional:
 *   SMS_AUTHORIZED_NUMBERS       – comma-separated E.164 numbers (+14155551212)
 *
 * Webhook (mounted in server.ts via twilio-webhooks.ts):
 *   POST /webhooks/sms/incoming
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  fn(`[${ts}] [${prefix}] [SMS] ${msg}`, err ?? '');
}

let singleton: SMSTwilioAdapter | null = null;
export function getSMSAdapter(): SMSTwilioAdapter | null {
  return singleton;
}

export class SMSTwilioAdapter implements ChannelAdapter {
  readonly channelId = 'sms' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private readonly sid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly authorized: Set<string>;

  constructor() {
    this.sid = process.env.TWILIO_ACCOUNT_SID ?? '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
    this.fromNumber = process.env.TWILIO_SMS_FROM ?? '';
    const list = process.env.SMS_AUTHORIZED_NUMBERS ?? '';
    this.authorized = new Set(list.split(',').map(s => s.trim()).filter(Boolean));
  }

  static isAvailable(): boolean {
    return !!process.env.TWILIO_ACCOUNT_SID
      && !!process.env.TWILIO_AUTH_TOKEN
      && !!process.env.TWILIO_SMS_FROM;
  }

  async init(): Promise<void> {
    if (!this.sid || !this.authToken || !this.fromNumber) {
      log('warn', 'Config Twilio SMS manquante — adapter désactivé');
      return;
    }
    this.ready = true;
    singleton = this;
    log('info', `Prêt (from=${this.fromNumber})`);
  }

  isAuthorized(senderPhone: string): boolean {
    if (this.authorized.size === 0) return false;
    const normalized = senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`;
    return this.authorized.has(normalized) || this.authorized.has(senderPhone);
  }

  async send(recipientId: string, text: string, _opts?: SendOptions): Promise<void> {
    if (!this.ready) return;
    const to = recipientId.startsWith('+') ? recipientId : `+${recipientId}`;

    try {
      // SMS hard limit on a single segment is 160 chars; long messages become multi-segment.
      // Twilio will segment automatically, but we still cap very long messages to avoid fees.
      const MAX = 1600;
      const chunks = text.length <= MAX
        ? [text]
        : text.match(new RegExp(`[\\s\\S]{1,${MAX}}`, 'g')) ?? [text];

      for (const chunk of chunks) {
        await this.postMessage(to, chunk);
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (err: unknown) {
      log('error', `Erreur envoi SMS : ${(err as Error).message}`);
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

  async handleIncoming(form: Record<string, string>): Promise<string> {
    const from = String(form['From'] ?? '').trim();
    const body = String(form['Body'] ?? '').trim();

    if (!from || !body) return '<?xml version="1.0" encoding="UTF-8"?><Response/>';

    if (!this.isAuthorized(from)) {
      log('warn', `SMS non autorisé : ${from}`);
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Accès non autorisé.</Message></Response>`;
    }

    const universal: UniversalMessage = {
      id: String(form['MessageSid'] ?? Date.now()),
      channelId: 'sms',
      senderId: from,
      senderName: from,
      content: body,
      timestamp: new Date(),
      metadata: {
        smsSid: form['SmsSid'],
        numMedia: form['NumMedia'],
      },
    };

    this.messageHandler?.(universal).catch(err => log('error', 'handler', err));
    return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
  }
}
