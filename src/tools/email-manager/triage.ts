/**
 * INTRACLAW — Email Triage Engine
 * Classe et priorise les emails en utilisant l'IA
 */
import type { TriageResult } from './types';
import { ask } from '../../ai';
import { AgentTask } from '../../types';
import { userContextPrompt } from '../../config/profile';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = { info: '\u2705', warn: '\u26a0\ufe0f', error: '\u274c' }[level];
  console[level === 'info' ? 'log' : level](`[${ts}] ${prefix} [EmailTriage] ${msg}`);
}

export async function triageEmail(email: {
  from: string;
  subject: string;
  body: string;
  date?: string;
}): Promise<TriageResult> {
  const userCtx = userContextPrompt() || 'an independent developer';
  const prompt = `Tu es un assistant de triage d'emails pour ${userCtx}.

EMAIL À TRIER :
De : ${email.from}
Sujet : ${email.subject}
Date : ${email.date || 'inconnue'}
Corps : ${email.body.slice(0, 1500)}

CATÉGORIES :
- URGENT : deadline < 24h, action critique
- CLIENT : client existant (paiement, projet en cours)
- PROSPECT : potentiel nouveau client (demande de devis, contact initial)
- PARTNER : partenaire, collaborateur
- NEWSLETTER : email marketing, blog digest
- INVOICE : facture, reçu, paiement
- INTERNAL : notifications système (GitHub, Vercel, etc.)
- SPAM : indésirable
- OTHER : inclassable

ACTIONS :
- reply_now : réponse urgente nécessaire
- reply_later : peut attendre 24-48h
- archive : juste lire et archiver
- delete : supprimer
- unsubscribe : newsletter non souhaitée
- forward : transférer à quelqu'un d'autre

Réponds UNIQUEMENT en JSON valide, sans rien d'autre :
{"category":"CATÉGORIE","priority":1-5,"suggestedAction":"action","summary":"résumé en 1 phrase","draftReply":"brouillon de réponse ou null","confidence":0.0-1.0}`;

  try {
    const response = await ask({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 500,
      temperature: 0.2,
      task: AgentTask.MAINTENANCE,
      modelTier: 'fast',
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log('warn', `Réponse IA non-JSON pour ${email.subject}`);
      return defaultTriage(email);
    }

    const result = JSON.parse(jsonMatch[0]) as TriageResult;

    // Validation basique
    if (!result.category || !result.priority || !result.suggestedAction) {
      return defaultTriage(email);
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `Erreur triage ${email.subject}: ${message}`);
    return defaultTriage(email);
  }
}

function defaultTriage(email: { from: string; subject: string }): TriageResult {
  return {
    category:        'OTHER',
    priority:        3,
    suggestedAction: 'archive',
    summary:         `Email de ${email.from}: ${email.subject}`,
    confidence:      0.1,
  };
}

/**
 * Triage en batch — parallélise les appels IA (max 5 en parallèle)
 */
export async function triageEmails(emails: { from: string; subject: string; body: string; date?: string }[]): Promise<TriageResult[]> {
  const BATCH_SIZE = 5;
  const results: TriageResult[] = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(e => triageEmail(e)));
    results.push(...batchResults);
  }

  return results;
}
