/**
 * INTRACLAW — Email Channel Adapter
 *
 * Polls IMAP inbox for new mail from authorized senders, replies via SMTP.
 *
 * Required env:
 *   EMAIL_IMAP_HOST
 *   EMAIL_IMAP_USER
 *   EMAIL_IMAP_PASS
 *   EMAIL_SMTP_HOST
 *
 * Optional:
 *   EMAIL_IMAP_PORT               (default 993, TLS)
 *   EMAIL_SMTP_PORT               (default 465, TLS)
 *   EMAIL_SMTP_USER               (defaults to EMAIL_IMAP_USER)
 *   EMAIL_SMTP_PASS               (defaults to EMAIL_IMAP_PASS)
 *   EMAIL_AUTHORIZED_SENDERS      – comma-separated addresses
 *   EMAIL_POLL_INTERVAL_MS        (default 60000)
 *
 * Graceful degradation: if `imapflow` or `nodemailer` is not installed the
 * adapter logs a warning and stays in a disabled-but-safe state.
 */
import type { ChannelAdapter, UniversalMessage, SendOptions } from './types';

function log(level: 'info' | 'warn' | 'error', msg: string, err?: unknown): void {
  const prefix = { info: 'OK', warn: 'WARN', error: 'ERR' }[level];
  const ts = new Date().toISOString().slice(11, 19);
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error;
  fn(`[${ts}] [${prefix}] [Email] ${msg}`, err ?? '');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseAddress(raw: string): string {
  // "Name <user@host>" → "user@host" | "user@host" → "user@host"
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

export class EmailChannelAdapter implements ChannelAdapter {
  readonly channelId = 'email' as const;
  private ready = false;
  private messageHandler?: (msg: UniversalMessage) => Promise<void>;
  private pollTimer: NodeJS.Timeout | null = null;
  private transporter: any = null;
  private imapCtor: any = null;
  private lastSeenUID = 0;

  private readonly imapHost: string;
  private readonly imapPort: number;
  private readonly imapUser: string;
  private readonly imapPass: string;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly pollMs: number;
  private readonly authorized: Set<string>;

  constructor() {
    this.imapHost = process.env.EMAIL_IMAP_HOST ?? '';
    this.imapPort = parseInt(process.env.EMAIL_IMAP_PORT ?? '993', 10);
    this.imapUser = process.env.EMAIL_IMAP_USER ?? '';
    this.imapPass = process.env.EMAIL_IMAP_PASS ?? '';
    this.smtpHost = process.env.EMAIL_SMTP_HOST ?? '';
    this.smtpPort = parseInt(process.env.EMAIL_SMTP_PORT ?? '465', 10);
    this.smtpUser = process.env.EMAIL_SMTP_USER ?? this.imapUser;
    this.smtpPass = process.env.EMAIL_SMTP_PASS ?? this.imapPass;
    this.pollMs = parseInt(process.env.EMAIL_POLL_INTERVAL_MS ?? '60000', 10);
    const list = process.env.EMAIL_AUTHORIZED_SENDERS ?? '';
    this.authorized = new Set(
      list.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
    );
  }

  static isAvailable(): boolean {
    return !!process.env.EMAIL_IMAP_HOST
      && !!process.env.EMAIL_IMAP_USER
      && !!process.env.EMAIL_IMAP_PASS
      && !!process.env.EMAIL_SMTP_HOST;
  }

  async init(): Promise<void> {
    if (!this.imapHost || !this.imapUser || !this.imapPass || !this.smtpHost) {
      log('warn', 'Config Email incomplète — adapter désactivé');
      return;
    }

    // Lazy-load imapflow
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('imapflow');
      this.imapCtor = mod.ImapFlow ?? mod.default ?? mod;
    } catch (err: unknown) {
      log('warn', `Package imapflow non installé — réception désactivée : ${(err as Error).message}`);
      return;
    }

    // Lazy-load nodemailer
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: this.smtpPort === 465,
        auth: { user: this.smtpUser, pass: this.smtpPass },
      });
    } catch (err: unknown) {
      log('warn', `Package nodemailer non installé — envoi désactivé : ${(err as Error).message}`);
      return;
    }

    this.ready = true;
    log('info', `Prêt (${this.imapUser}@${this.imapHost}, poll=${this.pollMs}ms)`);

    // Start polling loop
    this.scheduleNextPoll();
  }

  private scheduleNextPoll(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollOnce()
        .catch(e => log('warn', `Poll IMAP échoué : ${(e as Error).message}`))
        .finally(() => this.scheduleNextPoll());
    }, this.pollMs);
  }

  private async pollOnce(): Promise<void> {
    if (!this.imapCtor) return;
    const client = new this.imapCtor({
      host: this.imapHost,
      port: this.imapPort,
      secure: this.imapPort === 993,
      auth: { user: this.imapUser, pass: this.imapPass },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search unseen messages
        const uids: number[] = await client.search({ seen: false }) || [];
        for (const uid of uids) {
          if (uid <= this.lastSeenUID) continue;
          const msg = await client.fetchOne(uid, { envelope: true, source: true });
          if (!msg) continue;

          const fromRaw: string = msg.envelope?.from?.[0]?.address ?? '';
          const fromAddress = parseAddress(fromRaw);
          const subject: string = msg.envelope?.subject ?? '';

          if (this.authorized.size > 0 && !this.authorized.has(fromAddress)) {
            // Mark read to avoid re-processing
            await client.messageFlagsAdd(uid, ['\\Seen']);
            continue;
          }

          const bodyText = this.extractText(msg.source?.toString('utf-8') ?? '');
          const universal: UniversalMessage = {
            id: String(msg.uid),
            channelId: 'email',
            senderId: fromAddress,
            senderName: msg.envelope?.from?.[0]?.name ?? fromAddress,
            content: bodyText,
            timestamp: msg.envelope?.date ? new Date(msg.envelope.date) : new Date(),
            metadata: {
              subject,
              messageId: msg.envelope?.messageId,
            },
          };

          try {
            await this.messageHandler?.(universal);
          } catch (err) {
            log('error', 'Erreur handler email', err);
          }

          await client.messageFlagsAdd(uid, ['\\Seen']);
          if (uid > this.lastSeenUID) this.lastSeenUID = uid;
        }
      } finally {
        lock.release();
      }
    } finally {
      try { await client.logout(); } catch { /* ignore */ }
    }
  }

  private extractText(rfc822: string): string {
    // Very simple extractor: prefer text/plain part, strip HTML otherwise
    const lowered = rfc822.toLowerCase();
    const plainIdx = lowered.indexOf('content-type: text/plain');
    if (plainIdx !== -1) {
      const blankLine = rfc822.indexOf('\r\n\r\n', plainIdx);
      if (blankLine !== -1) {
        const endBoundary = rfc822.indexOf('\r\n--', blankLine);
        const slice = rfc822.slice(blankLine + 4, endBoundary === -1 ? undefined : endBoundary);
        return slice.trim();
      }
    }
    // Fallback: treat as HTML
    const htmlIdx = lowered.indexOf('content-type: text/html');
    if (htmlIdx !== -1) {
      const blankLine = rfc822.indexOf('\r\n\r\n', htmlIdx);
      if (blankLine !== -1) {
        return stripHtml(rfc822.slice(blankLine + 4));
      }
    }
    // Final fallback: whole body after first blank line
    const firstBlank = rfc822.indexOf('\r\n\r\n');
    if (firstBlank !== -1) return stripHtml(rfc822.slice(firstBlank + 4));
    return stripHtml(rfc822);
  }

  async send(recipientId: string, text: string, opts?: SendOptions): Promise<void> {
    if (!this.ready || !this.transporter) return;
    try {
      const subjectPrefix = 'Re: IntraClaw';
      await this.transporter.sendMail({
        from: this.smtpUser,
        to: recipientId,
        subject: (opts && (opts as any).subject) || subjectPrefix,
        text,
      });
    } catch (err: unknown) {
      log('error', `Erreur envoi email à ${recipientId}: ${(err as Error).message}`);
    }
  }

  async broadcast(text: string): Promise<void> {
    for (const addr of this.authorized) {
      await this.send(addr, text);
    }
  }

  onMessage(handler: (msg: UniversalMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  isReady(): boolean {
    return this.ready;
  }

  async destroy(): Promise<void> {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.ready = false;
  }
}
