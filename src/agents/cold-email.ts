import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { getProspectsByStatus, updateProspectStatus } from '../tools/notion';
import { sendEmail } from '../tools/gmail';
import { ProspectStatus, EmailType, AgentTask } from '../types';
import type { AgentResult, Prospect, ColdEmail } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const MAX_EMAILS_PER_RUN = 20;
const EMAIL_LOG_PATH = path.resolve(process.cwd(), 'data', 'emails-sent.json');

// ─── Telegram notifier (set by telegram.ts to avoid circular import) ──────────

let _telegramNotify: ((msg: string) => Promise<void>) | null = null;

export function setColdEmailNotifier(fn: (msg: string) => Promise<void>): void {
  _telegramNotify = fn;
}

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
  // Detect language from notes field
  const isNL = prospect.notes?.includes('Langue: NL') ?? false;
  const hasWebsite = !!prospect.website;

  const styleGuide = isNL ? `
STIJL (Nederlands — Vlaanderen):
- Begin NOOIT met "Ik ben" of "Ik heet"
- Begin met een specifieke observatie over hun zaak
- Gebruik → voor opsommingen (niet •)
- Max 120 woorden
- Toon: vriendelijk maar professioneel, niet aanmatigend
- CTA: "Mag ik u een gratis mockup sturen?" of "Heeft u 10 minuten deze week?"
- Handtekening: Ayman Idamre\nWebdesign professional\nintra-site.com · intra.web.site1@gmail.com
- GDPR: "Wenst u geen berichten meer? Antwoord STOP."

VOORBEELD AYMAN'S STIJL:
Onderwerp: Uw website — een snelle observatie

Goedendag,

Ik bekeek ${hasWebsite ? `uw site ${prospect.website}` : `uw aanwezigheid op Google`} en merkte een paar punten op:

→ [Specifiek probleem 1 dat ik zag]
→ [Specifiek probleem 2]

Voor een zaak zoals [naam] in [stad] kan een professionele website echt het verschil maken.

Bekijk een voorbeeld van mijn werk: intra-site.com

Gratis mockup beschikbaar, zonder engagement.

Ayman Idamre
intra-site.com · intra.web.site1@gmail.com` : `
STYLE (Français — Bruxelles/Wallonie) :
- Ne JAMAIS commencer par "Je m'appelle" ou "Je suis développeur"
- Commencer par "J'ai visité votre site X" ou "En cherchant X sur Google, j'ai remarqué..."
- Utiliser → pour les points (pas de •)
- Max 130 mots
- Ton : direct, bienveillant, jamais condescendant
- Observer 1 chose SPÉCIFIQUE sur leur présence (pas générique)
- CTA : "Appel de 10 minutes cette semaine ?" ou "Répondez simplement si intéressé"
- Signature : Ayman Idamre\nCréation de sites web professionnels\nintra-site.com · intra.web.site1@gmail.com
- RGPD : "Si vous ne souhaitez plus recevoir nos messages, répondez STOP."

EXEMPLES RÉELS D'AYMAN (reproduire ce style) :
Ex 1 — Site existant médiocre :
"J'ai visité votre site magicvelos.be en cherchant des magasins de vélos à Bruxelles — et j'ai tout de suite vu que vous perdez des clients potentiels.
→ Les images sont trop compressées : impression basse qualité
→ Trop de texte : le regard ne sait pas où se poser
→ Design manque d'épuration : donne l'impression que le commerce est dépassé
Jetez un œil à ce type de résultat : intra-site.com
Un appel de 10 minutes cette semaine ?"

Ex 2 — Pas de site :
"J'ai découvert Elle M Boutique et remarqué que votre présence en ligne pourrait être renforcée.
70% des visites viennent du téléphone — vos clientes potentielles vous cherchent avant de passer en magasin.
Je crée des sites professionnels livrés en 5-7 jours : design adapté à votre univers, mobile, référencé Google.
Maquette gratuite de ce que ça donnerait pour [Nom]. Intéressé(e) ?"`;

  const prompt = `Tu es IntraClaw. Génère un cold email pour Ayman Idamre (agence intra-site.com).

PROSPECT :
- Nom : ${prospect.businessName}
- Secteur : ${prospect.industry}
- Ville : ${prospect.location}
- Site actuel : ${hasWebsite ? prospect.website : 'AUCUN SITE DÉTECTÉ'}
- Douleur principale : ${prospect.painPoints[0] ?? 'présence en ligne insuffisante'}
- Notes : ${prospect.notes ?? ''}

${styleGuide}

RÈGLES ABSOLUES :
- 1 observation SPÉCIFIQUE sur leur situation réelle (site visité, pas de site détecté, etc.)
- Lien portfolio : intra-site.com (JAMAIS haiskills.vercel.app)
- Offre : maquette gratuite, sans engagement
- Format JSON strict

{"subject": "Objet max 60 chars", "body": "Corps HTML avec <p> et <br>"}`.trim();

  const response = await ask({
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: prompt },
    ],
    maxTokens:   500,
    temperature: 0.75,
    task: AgentTask.COLD_EMAIL,
    modelTier:   'balanced',  // Personalized emails need quality
  });

  const match = response.content.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
  if (!match) throw new Error(`AI response not valid JSON:\n${response.content.slice(0, 200)}`);

  const parsed = JSON.parse(match[0]) as { subject: string; body: string };
  return { subject: parsed.subject.slice(0, 60), body: parsed.body };
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
    modelTier:   'balanced',  // Follow-up emails need quality
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

    // Send Telegram report
    const report = [
      `📊 *Rapport Cold Email — ${new Date().toLocaleString('fr-BE')}*`,
      ``,
      `📧 Cold emails envoyés : *${emailsSent}*`,
      `🔄 Relances envoyées : *${followUpsSent}*`,
      `📬 Total aujourd'hui : *${getEmailsSentToday()}*`,
      ``,
      `✅ Mission terminée.`,
    ].join('\n');

    try {
      await _telegramNotify?.(report);
    } catch { /* non-blocking */ }

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
