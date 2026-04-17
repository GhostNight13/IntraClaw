/**
 * Gmail API wrapper using google-auth-library + native fetch.
 * Avoids importing the full `googleapis` package (323 APIs = slow tsc).
 */
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';
import { userName, userEmail, userWebsite, userBusiness } from '../config/profile';

const SENDER_EMAIL = process.env.GMAIL_SENDER_EMAIL ?? userEmail();
const SENDER_NAME  = userName();
const GMAIL_API    = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ─── Signature & RGPD footer ──────────────────────────────────────────────────

function buildSignature(): string {
  const name = userName();
  const email = userEmail();
  const site = userWebsite();
  const biz = userBusiness();
  return `
<br><br>
<div style="font-family:Arial,sans-serif;font-size:13px;color:#555;border-top:1px solid #ddd;padding-top:10px;margin-top:10px;">
  <strong>${name}</strong><br>
  ${biz || 'IntraClaw user'}<br>
  📧 <a href="mailto:${email}">${email}</a>${site ? ` | 🌐 <a href="${site}">${site.replace(/^https?:\/\//, '')}</a>` : ''}
</div>`;
}

const SIGNATURE_HTML = buildSignature();

const RGPD_FOOTER_HTML = `
<div style="font-family:Arial,sans-serif;font-size:11px;color:#999;margin-top:20px;border-top:1px solid #eee;padding-top:8px;">
  Vous recevez cet email car votre entreprise figure dans l'annuaire public.
  Conformément au RGPD, vous pouvez vous désinscrire en répondant "STOP" à cet email.
</div>`;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getOAuthClient(): OAuth2Client {
  const clientId     = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail OAuth credentials missing (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)');
  }

  const auth = new OAuth2Client(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

async function getAccessToken(): Promise<string> {
  const auth = getOAuthClient();
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Failed to get Gmail access token');
  return token;
}

// ─── MIME builder ─────────────────────────────────────────────────────────────

function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildMimeMessage(to: string, subject: string, htmlBody: string, inReplyTo?: string): string {
  const fullHtml = htmlBody + SIGNATURE_HTML + RGPD_FOOTER_HTML;
  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const headers = [
    `From: ${SENDER_NAME} <${SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    inReplyTo ? `References: ${inReplyTo}` : null,
  ].filter((h): h is string => h !== null).join('\r\n');

  return `${headers}\r\n\r\n${fullHtml}`;
}

// ─── Gmail REST API calls ─────────────────────────────────────────────────────

interface GmailSendResponse { id: string; threadId: string }
interface GmailListResponse { messages?: Array<{ id: string; threadId: string }> }
interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

async function gmailFetch<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${GMAIL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gmail API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SentEmailResult {
  messageId: string;
  threadId:  string;
  sentAt:    string;
}

export interface ReceivedEmail {
  id:         string;
  threadId:   string;
  from:       string;
  subject:    string;
  snippet:    string;
  receivedAt: string;
  isRead:     boolean;
}

/**
 * Send an HTML email via Gmail API.
 * Automatically appends the configured user signature and RGPD footer.
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  inReplyTo?: string
): Promise<SentEmailResult> {
  if (!rateLimiter.check('gmail')) {
    throw new Error('Gmail daily rate limit reached (50/day)');
  }

  const raw = toBase64Url(buildMimeMessage(to, subject, htmlBody, inReplyTo));
  logger.info('Gmail', `Sending to ${to}: "${subject}"`);

  const result = await gmailFetch<GmailSendResponse>('/messages/send', 'POST', { raw });

  logger.info('Gmail', `Sent`, { messageId: result.id, to });
  return { messageId: result.id, threadId: result.threadId, sentAt: new Date().toISOString() };
}

/**
 * Fetch unread emails from inbox (to detect prospect replies).
 */
export async function getUnreadEmails(maxResults = 20): Promise<ReceivedEmail[]> {
  const listResult = await gmailFetch<GmailListResponse>(
    `/messages?q=is:unread+in:inbox&maxResults=${maxResults}`,
    'GET'
  );

  const messages = listResult.messages ?? [];
  if (messages.length === 0) return [];

  const results: ReceivedEmail[] = [];

  for (const msg of messages) {
    try {
      const detail = await gmailFetch<GmailMessageResponse>(
        `/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        'GET'
      );

      const headers = detail.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      results.push({
        id:         msg.id,
        threadId:   detail.threadId,
        from:       get('From'),
        subject:    get('Subject'),
        snippet:    detail.snippet ?? '',
        receivedAt: get('Date'),
        isRead:     false,
      });
    } catch (err) {
      logger.warn('Gmail', `Failed to fetch message ${msg.id}`, err instanceof Error ? err.message : err);
    }
  }

  logger.info('Gmail', `Fetched ${results.length} unread emails`);
  return results;
}

/**
 * Mark an email as read.
 */
export async function markAsRead(messageId: string): Promise<void> {
  await gmailFetch(`/messages/${messageId}/modify`, 'POST', {
    removeLabelIds: ['UNREAD'],
  });
  logger.info('Gmail', `Marked as read: ${messageId}`);
}
