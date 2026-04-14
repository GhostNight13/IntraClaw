/**
 * INTRACLAW — Email Digest Generator
 * Génère un résumé quotidien des emails non lus
 */
import type { EmailDigest, TriagedEmail } from './types';
import { triageEmail } from './triage';
import { getUnreadEmails } from '../gmail';

function log(level: 'info' | 'warn', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: '\u2705', warn: '\u26a0\ufe0f' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [EmailDigest] ${msg}`);
}

export async function generateEmailDigest(): Promise<EmailDigest> {
  let rawEmails;
  try {
    rawEmails = await getUnreadEmails(30); // Max 30 pour le digest
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log('warn', `Erreur lecture emails: ${message}`);
    return emptyDigest();
  }

  if (!rawEmails || rawEmails.length === 0) {
    return emptyDigest();
  }

  // Triage de chaque email
  const triaged: TriagedEmail[] = [];
  for (const raw of rawEmails) {
    try {
      const triage = await triageEmail({
        from:    raw.from    || '',
        subject: raw.subject || '(Sans sujet)',
        body:    raw.snippet || '',
        date:    raw.receivedAt || '',
      });
      triaged.push({
        from:    raw.from    || '',
        subject: raw.subject || '(Sans sujet)',
        date:    raw.receivedAt || '',
        triage,
      });
    } catch {
      // Skip les emails qui échouent au triage
    }
  }

  // Classement par catégorie
  const urgent      = triaged.filter(t => t.triage.priority === 1 || t.triage.category === 'URGENT');
  const clients     = triaged.filter(t => t.triage.category === 'CLIENT');
  const prospects   = triaged.filter(t => t.triage.category === 'PROSPECT');
  const newsletters = triaged.filter(t => t.triage.category === 'NEWSLETTER');
  const other       = triaged.filter(t =>
    !['URGENT', 'CLIENT', 'PROSPECT', 'NEWSLETTER'].includes(t.triage.category) && t.triage.priority > 1
  );

  const digest: EmailDigest = {
    date:        new Date().toLocaleDateString('fr-BE'),
    totalUnread: rawEmails.length,
    urgent,
    clients,
    prospects,
    newsletters,
    other,
    summary:     buildSummary(urgent, clients, prospects, rawEmails.length),
  };

  log('info', `Digest généré : ${rawEmails.length} emails triés`);
  return digest;
}

function buildSummary(
  urgent: TriagedEmail[],
  clients: TriagedEmail[],
  prospects: TriagedEmail[],
  total: number
): string {
  const parts: string[] = [];
  if (urgent.length > 0) parts.push(`${urgent.length} urgent(s) à traiter immédiatement`);
  if (clients.length > 0) parts.push(`${clients.length} email(s) client`);
  if (prospects.length > 0) parts.push(`${prospects.length} prospect(s) potentiel(s)`);

  return parts.length > 0
    ? `${total} emails non lus. ${parts.join(', ')}.`
    : `${total} emails non lus, rien d'urgent.`;
}

export function formatDigestForTelegram(digest: EmailDigest): string {
  const section = (title: string, items: TriagedEmail[]) => {
    if (items.length === 0) return '';
    const lines = items.map(t => `  \u2022 <b>${t.from}</b>: ${t.triage.summary}`).join('\n');
    return `\n${title}\n${lines}`;
  };

  return [
    `\ud83d\udce7 <b>DIGEST EMAIL \u2014 ${digest.date}</b>`,
    `\ud83d\udcca ${digest.totalUnread} emails non lus`,
    section('\ud83d\udd34 URGENT', digest.urgent),
    section('\ud83d\udc64 CLIENTS', digest.clients),
    section('\ud83c\udfaf PROSPECTS', digest.prospects),
    section('\ud83d\udcf0 NEWSLETTERS', digest.newsletters),
    digest.other.length > 0 ? `\n\ud83d\udccb Et ${digest.other.length} autre(s)` : '',
    `\n\ud83d\udca1 ${digest.summary}`,
  ].filter(Boolean).join('\n');
}

function emptyDigest(): EmailDigest {
  return {
    date:        new Date().toLocaleDateString('fr-BE'),
    totalUnread: 0,
    urgent:      [],
    clients:     [],
    prospects:   [],
    newsletters: [],
    other:       [],
    summary:     'Aucun email non lu.',
  };
}
