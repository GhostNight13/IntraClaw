import { logger } from '../utils/logger';

// Free tier: no API key required (rate-limited at ~400 req/100s per IP)
// With key (optional): PAGESPEED_API_KEY env var
const BASE_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

export type PageSpeedStrategy = 'mobile' | 'desktop';

export interface PageSpeedAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;    // 0–1, null = informational
  displayValue?: string;
}

export interface PageSpeedResult {
  url: string;
  strategy: PageSpeedStrategy;
  performanceScore: number;    // 0–100
  accessibilityScore: number;
  seoScore: number;
  bestPracticesScore: number;
  metrics: {
    fcp: string;   // First Contentful Paint
    lcp: string;   // Largest Contentful Paint
    tbt: string;   // Total Blocking Time
    cls: string;   // Cumulative Layout Shift
    si:  string;   // Speed Index
    tti: string;   // Time to Interactive
  };
  failedAudits: PageSpeedAudit[];
  fetchedAt: string;
}

interface LighthouseResult {
  categories: {
    performance?:      { score: number };
    accessibility?:    { score: number };
    'best-practices'?: { score: number };
    seo?:              { score: number };
  };
  audits: Record<string, {
    id: string;
    title: string;
    description: string;
    score: number | null;
    displayValue?: string;
    scoreDisplayMode: string;
  }>;
}

interface PageSpeedApiResponse {
  lighthouseResult: LighthouseResult;
}

async function fetchWithTimeout(url: string, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function scoreToInt(score: number | undefined | null): number {
  if (score == null) return 0;
  return Math.round(score * 100);
}

function getMetricValue(audits: LighthouseResult['audits'], id: string): string {
  return audits[id]?.displayValue ?? 'N/A';
}

/**
 * Analyze a URL with Google PageSpeed Insights.
 * Returns performance scores + failed audits that explain poor performance.
 */
export async function analyzeUrl(
  url: string,
  strategy: PageSpeedStrategy = 'mobile'
): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY ?? '';
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : '';

  const apiUrl =
    `${BASE_URL}?url=${encodeURIComponent(url)}` +
    `&strategy=${strategy}` +
    `&category=performance&category=accessibility&category=best-practices&category=seo` +
    keyParam;

  logger.info('PageSpeed', `Analyzing ${url} (${strategy})`);

  const response = await fetchWithTimeout(apiUrl, 45_000);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PageSpeed API HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json() as PageSpeedApiResponse;
  const lhr = data.lighthouseResult;

  // Extract failed audits (score < 0.9, not informational)
  const failedAudits: PageSpeedAudit[] = Object.values(lhr.audits)
    .filter(a =>
      a.score !== null &&
      a.score < 0.9 &&
      a.scoreDisplayMode !== 'informative' &&
      a.scoreDisplayMode !== 'notApplicable' &&
      a.scoreDisplayMode !== 'manual'
    )
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 10)
    .map(a => ({
      id:           a.id,
      title:        a.title,
      description:  a.description,
      score:        a.score,
      displayValue: a.displayValue,
    }));

  const result: PageSpeedResult = {
    url,
    strategy,
    performanceScore:    scoreToInt(lhr.categories.performance?.score),
    accessibilityScore:  scoreToInt(lhr.categories.accessibility?.score),
    seoScore:            scoreToInt(lhr.categories.seo?.score),
    bestPracticesScore:  scoreToInt(lhr.categories['best-practices']?.score),
    metrics: {
      fcp: getMetricValue(lhr.audits, 'first-contentful-paint'),
      lcp: getMetricValue(lhr.audits, 'largest-contentful-paint'),
      tbt: getMetricValue(lhr.audits, 'total-blocking-time'),
      cls: getMetricValue(lhr.audits, 'cumulative-layout-shift'),
      si:  getMetricValue(lhr.audits, 'speed-index'),
      tti: getMetricValue(lhr.audits, 'interactive'),
    },
    failedAudits,
    fetchedAt: new Date().toISOString(),
  };

  logger.info('PageSpeed', `Score: perf=${result.performanceScore} seo=${result.seoScore}`, {
    url,
    strategy,
  });

  return result;
}

/**
 * Format PageSpeed result as a French diagnosis (for cold email personalization).
 */
export function formatDiagnosisFr(r: PageSpeedResult): string {
  const perf = r.performanceScore;
  let grade = perf >= 90 ? 'excellent' : perf >= 50 ? 'moyen' : 'faible';

  const lines = [
    `Performance (mobile) : ${perf}/100 — ${grade}`,
    `SEO : ${r.seoScore}/100`,
    `Accessibilité : ${r.accessibilityScore}/100`,
  ];

  if (r.failedAudits.length > 0) {
    lines.push('Problèmes détectés :');
    r.failedAudits.slice(0, 3).forEach(a => {
      lines.push(`  • ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
    });
  }

  return lines.join('\n');
}
