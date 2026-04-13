import { logger } from '../utils/logger';
import { ask } from '../ai';
import { buildSystemPrompt } from '../memory/core';
import { scrapeGoogleMaps, getRandomBelgiumTarget, BelgiumTarget } from '../tools/scraper';
import { analyzeUrl, formatDiagnosisFr } from '../tools/pagespeed';
import { verifyEmail } from '../tools/email-verify';
import { addProspect, findDuplicateProspect } from '../tools/notion';
import { ProspectStatus, AgentTask } from '../types';
import type { AgentResult, Prospect } from '../types';

const MAX_PROSPECTS_PER_RUN = 30;

/**
 * Use AI to infer pain points from scraped business data + PageSpeed analysis.
 */
async function inferPainPoints(
  businessName: string,
  category: string,
  pageSpeedDiagnosis: string | null
): Promise<string[]> {
  const prompt = `
Tu es IntraClaw, expert en marketing B2B pour PME bruxelloises.

Business : "${businessName}" (secteur : ${category})
${pageSpeedDiagnosis ? `Diagnostic site web :\n${pageSpeedDiagnosis}` : 'Pas de site web détecté.'}

Identifie 2-3 douleurs business concrètes que ce type d'entreprise ressent face à sa présence en ligne.
Réponds UNIQUEMENT avec une liste JSON : ["douleur 1", "douleur 2", "douleur 3"]
Pas d'explication, juste le JSON.
`.trim();

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user',   content: prompt },
      ],
      maxTokens:   200,
      temperature: 0.5,
      task: AgentTask.PROSPECTING,
      modelTier:   'fast',  // Pain point inference = simple classification
    });

    const match = response.content.match(/\[.*?\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]) as string[];
      return parsed.slice(0, 3);
    }
  } catch (err) {
    logger.warn('Prospection', 'Failed to infer pain points via AI', err instanceof Error ? err.message : err);
  }

  // Fallback generic pain points
  return [
    'Site web absent ou non référencé sur Google',
    'Perte de clients potentiels cherchant en ligne',
    'Présence digitale insuffisante face à la concurrence',
  ];
}

/**
 * Try to guess a professional email from business name and domain.
 */
function guessEmail(businessName: string, website?: string): string | null {
  if (!website) return null;
  try {
    const domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
      .replace(/^www\./, '');
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    return `contact@${domain}`;
  } catch {
    return null;
  }
}

export async function runProspectionAgent(): Promise<AgentResult<{ prospectsAdded: number }>> {
  const start = Date.now();
  logger.info('Prospection', '=== Starting Belgium-wide prospection ===');

  let prospectsAdded = 0;

  try {
    // Pick 3 different Belgian targets to maximize coverage
    const targets: BelgiumTarget[] = [];
    const used = new Set<string>();
    while (targets.length < 3) {
      const t = getRandomBelgiumTarget();
      if (!used.has(t.query)) { targets.push(t); used.add(t.query); }
    }

    for (const target of targets) {
      if (prospectsAdded >= MAX_PROSPECTS_PER_RUN) break;
      logger.info('Prospection', `Searching: "${target.query}" (${target.language.toUpperCase()})`);

      const businesses = await scrapeGoogleMaps(target.query, 15);
      logger.info('Prospection', `Scraped ${businesses.length} businesses in ${target.city}`);

      for (const biz of businesses) {
        if (prospectsAdded >= MAX_PROSPECTS_PER_RUN) break;

        const guessedEmail = guessEmail(biz.name, biz.website);
        if (!guessedEmail && !biz.phone) continue;

        const email = guessedEmail ?? '';
        if (email) {
          const isDupe = await findDuplicateProspect(email);
          if (isDupe) continue;
        }

        let emailValid = false;
        if (email) {
          const verifyResult = await verifyEmail(email);
          emailValid = verifyResult.valid;
        }

        let pageSpeedDiagnosis: string | null = null;
        if (biz.website) {
          try {
            const psResult = await analyzeUrl(biz.website, 'mobile');
            pageSpeedDiagnosis = formatDiagnosisFr(psResult);
          } catch { /* skip */ }
        }

        const painPoints = await inferPainPoints(biz.name, biz.category, pageSpeedDiagnosis);

        const prospect: Omit<Prospect, 'id' | 'createdAt'> = {
          name:           biz.name,
          businessName:   biz.name,
          email,
          phone:          biz.phone,
          website:        biz.website,
          industry:       biz.category || target.query.split(' ')[0],
          location:       biz.address || target.city,
          status:         ProspectStatus.NEW,
          source:         'google_maps',
          painPoints,
          notes: [
            `Région: ${target.region} | Langue: ${target.language.toUpperCase()}`,
            pageSpeedDiagnosis ? `PageSpeed: ${pageSpeedDiagnosis.split('\n')[0]}` : '',
            !biz.hasWebsite ? '⚠️ Pas de site web' : '',
            !emailValid && email ? '⚠️ Email non vérifié' : '',
          ].filter(Boolean).join(' | '),
          lastContactedAt: undefined,
          convertedAt:     undefined,
        };

        try {
          await addProspect(prospect);
          prospectsAdded++;
          logger.info('Prospection', `Added: ${biz.name} (${target.city}, ${target.language.toUpperCase()})`);
        } catch (err) {
          logger.error('Prospection', `Failed: ${biz.name}`, err instanceof Error ? err.message : err);
        }
      }
    }

    logger.info('Prospection', `=== Done: ${prospectsAdded} prospects ===`);

    return {
      task:       AgentTask.PROSPECTING,
      success:    true,
      data:       { prospectsAdded },
      durationMs: Date.now() - start,
      model:      'claude',
      timestamp:  new Date().toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Prospection', 'Agent failed', message);
    return {
      task:       AgentTask.PROSPECTING,
      success:    false,
      error:      message,
      durationMs: Date.now() - start,
      model:      'none',
      timestamp:  new Date().toISOString(),
    };
  }
}
