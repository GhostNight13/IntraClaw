// src/tools/browser-control.ts
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { logger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'data', 'screenshots');

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

function ensureScreenshotsDir(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    logger.info('BrowserControl', 'Browser launched');
  }
  return _browser;
}

export async function getPage(): Promise<Page> {
  const browser = await getBrowser();
  if (!_context) {
    _context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1280, height: 720 },
    });
  }
  return _context.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (_context) { await _context.close(); _context = null; }
  if (_browser) { await _browser.close(); _browser = null; }
  logger.info('BrowserControl', 'Browser closed');
}

/**
 * Navigate to URL and return page content as text.
 */
export async function navigateAndExtract(url: string): Promise<{
  title: string;
  text: string;
  url: string;
}> {
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title();
    const text  = await page.innerText('body').catch(() => '');
    return { title, text: text.slice(0, 10000), url: page.url() };
  } finally {
    await page.close();
  }
}

/**
 * Take a screenshot of any URL.
 */
export async function takeScreenshot(url: string, filename?: string): Promise<string> {
  ensureScreenshotsDir();
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const name = filename ?? `screenshot-${Date.now()}.png`;
    const filePath = path.join(SCREENSHOTS_DIR, name);
    await page.screenshot({ path: filePath, fullPage: false });
    logger.info('BrowserControl', `Screenshot saved: ${filePath}`);
    return filePath;
  } finally {
    await page.close();
  }
}

/**
 * Fill a form field on a page.
 */
export async function fillForm(url: string, fields: Array<{ selector: string; value: string }>, submitSelector?: string): Promise<{
  success: boolean;
  screenshotPath?: string;
}> {
  ensureScreenshotsDir();
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (const field of fields) {
      await page.fill(field.selector, field.value);
    }

    if (submitSelector) {
      await page.click(submitSelector);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    }

    const screenshotPath = path.join(SCREENSHOTS_DIR, `form-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });

    return { success: true, screenshotPath };
  } catch (err) {
    logger.error('BrowserControl', 'Form fill failed', err instanceof Error ? err.message : err);
    return { success: false };
  } finally {
    await page.close();
  }
}

/**
 * Click an element on a page.
 */
export async function clickElement(url: string, selector: string): Promise<boolean> {
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.click(selector, { timeout: 5000 });
    return true;
  } catch (err) {
    logger.error('BrowserControl', `Click failed: ${selector}`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    await page.close();
  }
}

/**
 * Execute JavaScript in page context and return result.
 */
export async function evaluateOnPage(url: string, script: string): Promise<unknown> {
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return await page.evaluate(script);
  } finally {
    await page.close();
  }
}

/**
 * Get a simplified DOM tree of a page (useful for AI navigation).
 * Extracts interactive elements: links, buttons, inputs, selects, textareas.
 */
export async function getPageStructure(url: string): Promise<string> {
  const page = await getPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const script = `(() => {
      const selectors = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="textbox"]';
      const elements = Array.from(document.querySelectorAll(selectors));
      return elements.slice(0, 200).map(el => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        text: (el.textContent || '').trim().slice(0, 80),
        href: el.getAttribute('href') || '',
        name: el.getAttribute('name') || '',
        id: el.id || '',
        type: el.getAttribute('type') || '',
        placeholder: el.getAttribute('placeholder') || '',
      }));
    })()`;
    const structure = await page.evaluate(script);
    return JSON.stringify(structure, null, 2).slice(0, 15000);
  } finally {
    await page.close();
  }
}
