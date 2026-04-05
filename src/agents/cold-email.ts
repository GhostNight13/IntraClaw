import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { getProspectsByStatus, updateProspectStatus } from '../tools/notion';
import { sendEmail } from '../tools/gmail';
import { ProspectStatus, EmailType, AgentTask } from '../types';
import type { AgentResult, Prospect, ColdEmail } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const MAX_EMAILS_PER_RUN = 5;
const EMAIL_LOG_PATH = path.resolve(process.cwd(), 'data', 'emails-sent.json');

// ─── Email log (lightweight persistence) ─────────────────────────────────────

interface EmailLogEntry {
  prospectId: string;
  prospectName: string;
  email: string;
  subject: string;
  sentAt: string;
  type: EmailType;
}

function loadEmailLog(): EmailLogEntry[] {
  try {
    if (!fs.existsSync(EMAIL_LOG_PATH)) return [];
    return JSON.parse(fs.readFileSync(EMAIL_LOG_PATH, 'utf8')) as EmailLogEntry[];
  } catch {
    return [];
  }
}

function appendEmailLog(entry: EmailLogEntry): void {
  try {
    const dir = path.dirname(EMAIL_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const log = loadEmailLog();
    log.push(entry);
    fs.writeFileSync(EMAIL_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
  } catch (err) {
    logger.error('ColdEmail', 'Failed to write email log', err);
  }
}

function alreadyEmailed(email: string): boolean {
  const log = loadEmailLog();
  return log.some(e => e.email.toLowerCase() === email.toLowerCase());
}

// ─── Email generation ─────────────────────────────────────────────────────────

async function generateColdEmail(prospect: Prospect): Promise<Pick<ColdEmail, 'subject' | 'body'>> {
  const tone = prospect.industry.toLowerCase().includes('restaurant') ||
               prospect.industry.toLowerCase().includes('coiffeur') ||
               prospect.industry.toLowerCase().includes('boulangerie')
    ? 'direct et chaleureux'
    : 'professionnel et respectueux';

  const painPoint = prospect.painPoints[0] ?? 'une présence digitale insuffisante';
  const hasWebsite = !!prospect.website;

  const prompt = `
Tu es IntraClaw. Rédige un cold email COMPLET pour ce prospect.

MÉTHODE OBLIGATOIRE — 4-D (Lyra) :
1. Douleur — commence par le problème du prospect (1 phrase)
2. Désir — la solution idéale (1 phrase)
3. Décision — pourquoi Ayman (1 phrase + portfolio)
4. Deal — offre concrète, sans risque (1 phrase)

PROSPECT :
- Nom : ${prospect.businessName}
- Secteur : ${prospect.industry}
- Localisation : ${prospect.location}
- Douleur principale : ${painPoint}
- Site actuel : ${hasWebsite ? prospect.website : 'Aucun site détecté'}
- Ton requis : ${tone}

CONTRAINTES :
- Maximum 150 mots (corps uniquement, pas la signature)
- Commencer par le PROBLÈME, jamais par "Je m'appelle"
- Inclure : intra-site.com et l'offre maquette gratuite
- Ne PAS mentionner que c'est un email automatisé
- Langue : français

SORTIE OBLIGATOIRE (format JSON strict) :
{
  "subject": "Objet de l'email (max 60 caractères)",
  "body": "Corps HTML de l'email (paragraphes avec <p>)"
}
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   600,
    temperature: 0.8,
    task: AgentTask.COLD_EMAIL,
  });

  // Extract JSON from response
  const match = response.content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
  if (!match) {
    throw new Error(`AI response not valid JSON:\n${response.content.slice(0, 200)}`);
  }

  const parsed = JSON.parse(match[0]) as { subject: string; body: string };
  return {
    subject: parsed.subject.slice(0, 60),
    body:    parsed.body,
  };
}

// ─── Follow-up generation ─────────────────────────────────────────────────────

async function generateFollowUp(prospect: Prospect): Promise<Pick<ColdEmail, 'subject' | 'body'>> {
  const prompt = `
Tu es IntraClaw. Rédige un email de RELANCE pour ce prospect qui n'a pas répondu.

PROSPECT : ${prospect.businessName} (${prospect.industry})

Règles :
- Rappel très bref de la première prise de contact
- Nouvelle valeur ajoutée ou angle différent
- Appel à l'action simple : "Avez-vous 5 minutes cette semaine ?"
- Maximum 80 mots
- Ton : ${prospect.industry.includes('restaurant') ? 'direct' : 'professionnel'}

JSON strict :
{
  "subject": "Re: [Relance] Objet max 55 chars",
  "body": "<p>Corps HTML</p>"
}
`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   400,
    temperature: 0.7,
    task: AgentTask.COLD_EMAIL,
  });

  const match = response.content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
  if (!match) throw new Error('Follow-up generation failed: no JSON');

  return JSON.parse(match[0]) as { subject: string; body: string };
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runColdEmailAgent(): Promise<AgentResult<{ emailsSent: number; followUpsSent: number }>> {
  const start = Date.now();
  logger.info('ColdEmail', '=== Starting cold email agent ===');

  let emailsSent   = 0;
  let followUpsSent = 0;

  try {
    // 1. New prospects → cold email
    const newProspects = await getProspectsByStatus(ProspectStatus.NEW);
    logger.info('ColdEmail', `Found ${newProspects.length} new prospects`);

    for (const prospect of newProspects.slice(0, MAX_EMAILS_PER_RUN)) {
      if (!prospect.email) {
        logger.info('ColdEmail', `Skipping ${prospect.businessName} — no email`);
        continue;
      }

      if (alreadyEmailed(prospect.email)) {
        logger.info('ColdEmail', `Already emailed: ${prospect.email}`);
        continue;
      }

      try {
        const { subject, body } = await generateColdEmail(prospect);
        await sendEmail(prospect.email, subject, body);

        await updateProspectStatus(prospect.id, ProspectStatus.CONTACTED);
        appendEmailLog({
          prospectId:   prospect.id,
          prospectName: prospect.businessName,
          email:        prospect.email,
          subject,
          sentAt:       new Date().toISOString(),
          type:         EmailType.COLD_OUTREACH,
        });

        emailsSent++;
        logger.info('ColdEmail', `Cold email sent: ${prospect.businessName} <${prospect.email}>`);
      } catch (err) {
        logger.error('ColdEmail', `Failed for ${prospect.businessName}`, err instanceof Error ? err.message : err);
      }

      // Delay between sends (human-like)
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
    }

    // 2. Contacted prospects with no reply → follow-up (if contacted > 3 days ago)
    const contactedProspects = await getProspectsByStatus(ProspectStatus.CONTACTED);
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

    for (const prospect of contactedProspects) {
      if (emailsSent + followUpsSent >= MAX_EMAILS_PER_RUN) break;
      if (!prospect.email) continue;
      if (!prospect.lastContactedAt || prospect.lastContactedAt > threeDaysAgo) continue;

      try {
        const { subject, body } = await generateFollowUp(prospect);
        await sendEmail(prospect.email, subject, body);

        appendEmailLog({
          prospectId:   prospect.id,
          prospectName: prospect.businessName,
          email:        prospect.email,
          subject,
          sentAt:       new Date().toISOString(),
          type:         EmailType.FOLLOW_UP,
        });

        followUpsSent++;
        logger.info('ColdEmail', `Follow-up sent: ${prospect.businessName}`);
      } catch (err) {
        logger.error('ColdEmail', `Follow-up failed for ${prospect.businessName}`, err instanceof Error ? err.message : err);
      }

      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
    }

    logger.info('ColdEmail', `=== Done: ${emailsSent} cold emails + ${followUpsSent} follow-ups ===`);

    return {
      task:       AgentTask.COLD_EMAIL,
      success:    true,
      data:       { emailsSent, followUpsSent },
      durationMs: Date.now() - start,
      model:      'claude',
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('ColdEmail', 'Agent failed', message);
    return {
      task:       AgentTask.COLD_EMAIL,
      success:    false,
      error:      message,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}

export function getEmailsSentToday(): number {
  const today = new Date().toISOString().slice(0, 10);
  return loadEmailLog().filter(e => e.sentAt.startsWith(today)).length;
}
