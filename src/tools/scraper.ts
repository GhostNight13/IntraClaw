// @ts-nocheck
/**
 * Google Maps scraper — personal use, Brussels PME prospecting.
 * Uses require() for puppeteer to avoid loading its massive DevTools types
 * (which make tsc > 60s on this machine).
 * @ts-nocheck: browser context (document, window, navigator) used inside page.evaluate().
 *
 * NOTE: scraping Google Maps may violate ToS. Use responsibly at low volume
 * for legitimate personal business prospecting only.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const puppeteer = require('puppeteer') as {
  launch: (opts: Record<string, unknown>) => Promise<PuppeteerBrowser>;
};

// Minimal types — avoids loading Puppeteer's full DevTools Protocol typings
interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
}

interface PuppeteerPage {
  setUserAgent(ua: string): Promise<void>;
  setViewport(v: { width: number; height: number }): Promise<void>;
  evaluateOnNewDocument(script: string): Promise<void>;
  setRequestInterception(enable: boolean): Promise<void>;
  on(event: string, cb: (req: PuppeteerRequest) => void): void;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForSelector(sel: string, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  evaluate<T, A>(fn: (a: A) => T, arg: A): Promise<T>;
  $$(sel: string): Promise<unknown[]>;
  $(sel: string): Promise<{ click(): Promise<void> } | null>;
  close(): Promise<void>;
}

interface PuppeteerRequest {
  resourceType(): string;
  abort(): Promise<void>;
  continue(): Promise<void>;
}

import { logger } from '../utils/logger';
import { rateLimiter } from '../utils/rate-limiter';

export interface ScrapedBusiness {
  name: string;
  category: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  hasWebsite: boolean;
}

export const BRUSSELS_CATEGORIES = [
  'restaurant bruxelles',
  'coiffeur bruxelles',
  'boulangerie bruxelles',
  'plombier bruxelles',
  'électricien bruxelles',
  'garage voiture bruxelles',
  'dentiste bruxelles',
  'pharmacie bruxelles',
  'avocat bruxelles',
  'comptable bruxelles',
  'architecte bruxelles',
  'traiteur bruxelles',
  'fleuriste bruxelles',
  'librairie bruxelles',
  'photographe bruxelles',
];

export interface BelgiumTarget {
  query: string;
  city: string;
  region: 'brussels' | 'wallonia' | 'flanders';
  language: 'fr' | 'nl';
}

export const BELGIUM_TARGETS: BelgiumTarget[] = [
  // Brussels (French)
  { query: 'restaurant bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'coiffeur bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'boulangerie bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'plombier bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'électricien bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'garage voiture bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'photographe bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'fleuriste bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'traiteur bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  { query: 'architecte bruxelles', city: 'Bruxelles', region: 'brussels', language: 'fr' },
  // Liège (French)
  { query: 'restaurant liège', city: 'Liège', region: 'wallonia', language: 'fr' },
  { query: 'coiffeur liège', city: 'Liège', region: 'wallonia', language: 'fr' },
  { query: 'plombier liège', city: 'Liège', region: 'wallonia', language: 'fr' },
  { query: 'boulangerie liège', city: 'Liège', region: 'wallonia', language: 'fr' },
  { query: 'photographe liège', city: 'Liège', region: 'wallonia', language: 'fr' },
  // Charleroi (French)
  { query: 'restaurant charleroi', city: 'Charleroi', region: 'wallonia', language: 'fr' },
  { query: 'coiffeur charleroi', city: 'Charleroi', region: 'wallonia', language: 'fr' },
  { query: 'électricien charleroi', city: 'Charleroi', region: 'wallonia', language: 'fr' },
  { query: 'boulangerie charleroi', city: 'Charleroi', region: 'wallonia', language: 'fr' },
  // Namur (French)
  { query: 'restaurant namur', city: 'Namur', region: 'wallonia', language: 'fr' },
  { query: 'coiffeur namur', city: 'Namur', region: 'wallonia', language: 'fr' },
  { query: 'plombier namur', city: 'Namur', region: 'wallonia', language: 'fr' },
  // Antwerp (Dutch)
  { query: 'restaurant antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  { query: 'kapper antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  { query: 'loodgieter antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  { query: 'bakkerij antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  { query: 'fotograaf antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  { query: 'elektricien antwerpen', city: 'Antwerpen', region: 'flanders', language: 'nl' },
  // Ghent (Dutch)
  { query: 'restaurant gent', city: 'Gent', region: 'flanders', language: 'nl' },
  { query: 'kapper gent', city: 'Gent', region: 'flanders', language: 'nl' },
  { query: 'loodgieter gent', city: 'Gent', region: 'flanders', language: 'nl' },
  { query: 'bakkerij gent', city: 'Gent', region: 'flanders', language: 'nl' },
  // Bruges (Dutch)
  { query: 'restaurant brugge', city: 'Brugge', region: 'flanders', language: 'nl' },
  { query: 'kapper brugge', city: 'Brugge', region: 'flanders', language: 'nl' },
  { query: 'elektricien brugge', city: 'Brugge', region: 'flanders', language: 'nl' },
  // Leuven (Dutch)
  { query: 'restaurant leuven', city: 'Leuven', region: 'flanders', language: 'nl' },
  { query: 'kapper leuven', city: 'Leuven', region: 'flanders', language: 'nl' },
  // Mons (French)
  { query: 'restaurant mons', city: 'Mons', region: 'wallonia', language: 'fr' },
  { query: 'coiffeur mons', city: 'Mons', region: 'wallonia', language: 'fr' },
];

export function getRandomBelgiumTarget(): BelgiumTarget {
  return BELGIUM_TARGETS[Math.floor(Math.random() * BELGIUM_TARGETS.length)];
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  return sleep(minMs + Math.random() * (maxMs - minMs));
}

async function launchBrowser(): Promise<PuppeteerBrowser> {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
      '--lang=fr-BE,fr',
    ],
  });
}

async function setupPage(browser: PuppeteerBrowser): Promise<PuppeteerPage> {
  const page = await browser.newPage();
  await page.setUserAgent(randomUserAgent());
  await page.setViewport({
    width:  1366 + Math.floor(Math.random() * 100),
    height: 768  + Math.floor(Math.random() * 100),
  });
  // Override webdriver flag — passed as a string to avoid TypeScript DOM types
  await page.evaluateOnNewDocument(
    `Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
     window['chrome'] = { runtime: {} };`
  );
  await page.setRequestInterception(true);
  page.on('request', (req: PuppeteerRequest) => {
    const type = req.resourceType();
    if (['image', 'font', 'media'].includes(type)) {
      req.abort().catch(() => undefined);
    } else {
      req.continue().catch(() => undefined);
    }
  });
  return page;
}

async function acceptConsent(page: PuppeteerPage): Promise<void> {
  try {
    const btn = await page.$('button[aria-label*="Accept"]');
    if (btn) {
      await btn.click();
      await sleep(1500);
      logger.info('Scraper', 'Accepted Google consent');
    }
  } catch {
    // no consent dialog
  }
}

export async function scrapeGoogleMaps(
  query: string,
  maxResults = 10
): Promise<ScrapedBusiness[]> {
  if (!rateLimiter.check('scraping')) {
    throw new Error('Scraping daily rate limit reached (100/day)');
  }

  logger.info('Scraper', `Searching: "${query}"`, { maxResults });
  const browser = await launchBrowser();
  const results: ScrapedBusiness[] = [];

  try {
    const page = await setupPage(browser);
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await acceptConsent(page);
    await randomDelay(2000, 4000);

    const resultsSelector = '[role="feed"]';
    try {
      await page.waitForSelector(resultsSelector, { timeout: 15_000 });
    } catch {
      logger.warn('Scraper', 'Results panel not found — Google may have changed layout');
      return [];
    }

    const maxScrolls = Math.ceil(maxResults / 5);
    for (let i = 0; i < maxScrolls; i++) {
      await page.evaluate((sel: string) => {
        // browser context — document is available
        const el = (document as unknown as { querySelector(s: string): { scrollTop: number } | null }).querySelector(sel);
        if (el) el.scrollTop += 1200;
      }, resultsSelector);
      await randomDelay(1200, 2500);
    }

    const listingLinks = await page.evaluate(() => {
      const doc = document as unknown as {
        querySelectorAll(s: string): Array<{ href: string }>;
      };
      const links = Array.from(doc.querySelectorAll('a[href*="/maps/place/"]'))
        .map(el => el.href)
        .filter((h: string) => h.includes('/maps/place/'));
      return [...new Set(links)].slice(0, 20) as string[];
    });

    logger.info('Scraper', `Found ${listingLinks.length} listings`);

    for (const link of listingLinks.slice(0, maxResults)) {
      try {
        const biz = await scrapeListing(browser, link);
        if (biz) {
          results.push(biz);
          logger.info('Scraper', `Scraped: ${biz.name}`, { website: biz.hasWebsite ? biz.website : 'none' });
        }
        await randomDelay(1500, 3500);
      } catch (err) {
        logger.warn('Scraper', `Failed to scrape listing`, err instanceof Error ? err.message : err);
      }
    }
  } finally {
    await browser.close();
  }

  logger.info('Scraper', `Done: ${results.length} businesses`, { query });
  return results;
}

async function scrapeListing(browser: PuppeteerBrowser, url: string): Promise<ScrapedBusiness | null> {
  const page = await setupPage(browser);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await randomDelay(1500, 2500);

    return await page.evaluate(() => {
      type D = { querySelector(s: string): { innerText: string; getAttribute(a: string): string | null; href?: string; dataset?: Record<string, string> } | null; querySelectorAll(s: string): Array<{ innerText: string }> };
      const doc = document as unknown as D;
      const getText = (sel: string): string => {
        const el = doc.querySelector(sel);
        return el ? el.innerText.trim() : '';
      };
      const name = getText('h1');
      if (!name) return null;
      const category = getText('[jsaction*="category"]') ||
        doc.querySelector('[data-value]')?.dataset?.['value'] || '';
      const addressEls = doc.querySelectorAll('[data-item-id="address"] .fontBodyMedium');
      const address = addressEls.length > 0 ? addressEls[0].innerText.trim() : '';
      const phoneEls = doc.querySelectorAll('[data-item-id*="phone"] .fontBodyMedium');
      const phone: string | undefined = phoneEls.length > 0 ? phoneEls[0].innerText.trim() : undefined;
      const websiteEl = doc.querySelector('[data-item-id="authority"] a');
      const website: string | undefined = websiteEl?.href ?? undefined;
      const ratingEl = doc.querySelector('[aria-label*="étoiles"]') || doc.querySelector('[aria-label*="stars"]');
      const ratingText = ratingEl?.getAttribute('aria-label') ?? '';
      const ratingMatch = ratingText.match(/(\d+[.,]\d+)/);
      const rating: number | undefined = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
      const reviewEl = doc.querySelector('[aria-label*="avis"]') || doc.querySelector('[aria-label*="review"]');
      const reviewText = reviewEl?.getAttribute('aria-label') ?? '';
      const reviewMatch = reviewText.match(/(\d[\d\s]*)/);
      const reviewCount: number | undefined = reviewMatch ? parseInt(reviewMatch[1].replace(/\s/g, ''), 10) : undefined;
      return { name, category, address, phone, website, rating, reviewCount, hasWebsite: !!website };
    });
  } finally {
    await page.close();
  }
}

export function getTodayCategory(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  return BELGIUM_TARGETS[dayOfYear % BELGIUM_TARGETS.length].query;
}
