import * as dns from 'dns';
import { logger } from '../utils/logger';

export interface EmailVerifyResult {
  email: string;
  valid: boolean;
  reason: string;
  mxRecords: string[];
  checkedAt: string;
}

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'trashmail.com', '10minutemail.com', 'sharklasers.com',
  'guerrillamailblock.com', 'grr.la', 'guerrillamail.info', 'spam4.me',
]);

function isValidFormat(email: string): boolean {
  // RFC 5322 simplified
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

async function resolveMx(domain: string): Promise<dns.MxRecord[]> {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses);
    });
  });
}

/**
 * Verifies an email address by:
 * 1. Checking the format (RFC 5322)
 * 2. Checking the domain is not disposable
 * 3. Resolving MX records (no SMTP connection — DNS only)
 *
 * Free, no external API needed.
 */
export async function verifyEmail(email: string): Promise<EmailVerifyResult> {
  const base: EmailVerifyResult = {
    email,
    valid: false,
    reason: '',
    mxRecords: [],
    checkedAt: new Date().toISOString(),
  };

  // 1. Format check
  if (!isValidFormat(email)) {
    logger.info('EmailVerify', `Invalid format: ${email}`);
    return { ...base, reason: 'invalid_format' };
  }

  const domain = extractDomain(email);

  // 2. Disposable check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    logger.info('EmailVerify', `Disposable domain: ${domain}`);
    return { ...base, reason: 'disposable_domain' };
  }

  // 3. MX record lookup
  try {
    const mxRecords = await resolveMx(domain);

    if (!mxRecords || mxRecords.length === 0) {
      logger.info('EmailVerify', `No MX records for domain: ${domain}`);
      return { ...base, reason: 'no_mx_records' };
    }

    // Sort by priority (lowest = preferred)
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mxList = mxRecords.map(r => `${r.exchange} (priority ${r.priority})`);

    logger.info('EmailVerify', `Valid email: ${email}`, { mx: mxList[0] });
    return {
      ...base,
      valid: true,
      reason: 'ok',
      mxRecords: mxList,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('EmailVerify', `DNS lookup failed for ${domain}: ${msg}`);
    return { ...base, reason: `dns_error: ${msg}` };
  }
}

/**
 * Batch verify multiple emails. Returns only valid ones.
 */
export async function verifyEmails(emails: string[]): Promise<EmailVerifyResult[]> {
  const results = await Promise.allSettled(emails.map(verifyEmail));
  return results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((r): r is EmailVerifyResult => r !== null);
}
