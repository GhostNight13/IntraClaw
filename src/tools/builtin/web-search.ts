// src/tools/builtin/web-search.ts
// Zero-key web search: DDG Instant Answer + Google News RSS + Wikipedia + SearXNG
import type { ToolDefinition, ToolResult } from './types';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

// ─── DuckDuckGo Instant Answer ──────────────────────────────────────────────

async function searchDdgIA(query: string): Promise<SearchResult[]> {
  const url =
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
    `&format=json&no_html=1&skip_disambig=1&t=intraclaw`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const d = (await res.json()) as Record<string, unknown>;
  const results: SearchResult[] = [];

  if (d.Answer && typeof d.Answer === 'string' && d.Answer.trim())
    results.push({ title: String(d.AnswerType || 'Answer'), url: String(d.AbstractURL || ''), snippet: d.Answer as string, source: 'DuckDuckGo' });
  if (d.Abstract && typeof d.Abstract === 'string' && d.Abstract.trim())
    results.push({ title: String(d.Heading || query), url: String(d.AbstractURL || ''), snippet: d.Abstract as string, source: String(d.AbstractSource || 'DuckDuckGo') });
  if (Array.isArray(d.Results))
    for (const r of d.Results as Array<{ Text?: string; FirstURL?: string }>)
      if (r.Text && r.FirstURL) results.push({ title: r.Text.slice(0, 120), url: r.FirstURL, snippet: r.Text, source: 'DuckDuckGo' });
  if (Array.isArray(d.RelatedTopics))
    for (const t of d.RelatedTopics as Array<{ Text?: string; FirstURL?: string }>)
      if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 120), url: t.FirstURL, snippet: t.Text, source: 'DuckDuckGo' });
  return results;
}

// ─── Google News RSS ────────────────────────────────────────────────────────

async function searchGoogleNews(query: string, max = 8): Promise<SearchResult[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();

    const results: SearchResult[] = [];
    // Parse <item> blocks from RSS XML
    const items = xml.split('<item>').slice(1, max + 1);
    for (const item of items) {
      const titleMatch = item.match(/<title>([^<]*)<\/title>/);
      // Google News RSS uses <link>URL</link> (not self-closing)
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const pubDateMatch = item.match(/<pubDate>([^<]*)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>([^<]*)<\/source>/);
      if (titleMatch && linkMatch) {
        results.push({
          title: titleMatch[1].trim(),
          url: linkMatch[1].trim(),
          snippet: `${sourceMatch ? sourceMatch[1] + ' — ' : ''}${pubDateMatch ? pubDateMatch[1] : ''}`.trim(),
          source: sourceMatch ? sourceMatch[1] : 'Google News',
        });
      }
    }
    return results;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── Wikipedia Search ───────────────────────────────────────────────────────

async function searchWikipedia(query: string, max = 5): Promise<SearchResult[]> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${max}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const d = (await res.json()) as { query?: { search?: Array<{ title: string; snippet: string }> } };
    return (d.query?.search ?? []).map(r => ({
      title: r.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
      snippet: r.snippet.replace(/<[^>]+>/g, '').trim(),
      source: 'Wikipedia',
    }));
  } catch { return []; }
}

// ─── SearXNG fallback ───────────────────────────────────────────────────────

const SEARXNG = [
  'https://searx.be',
  'https://search.inetol.net',
  'https://searx.tiekoetter.com',
  'https://search.ononoki.org',
];

async function searchSearxng(query: string): Promise<SearchResult[]> {
  const start = Math.floor(Math.random() * SEARXNG.length);
  const order = [...SEARXNG.slice(start), ...SEARXNG.slice(0, start)];
  for (const base of order) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(
        `${base}/search?q=${encodeURIComponent(query)}&format=json&safesearch=1`,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal },
      );
      clearTimeout(timer);
      if (!res.ok) continue;
      const d = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string; engine?: string }> };
      if (!Array.isArray(d.results) || d.results.length === 0) continue;
      return d.results.filter(r => r.title && r.url).map(r => ({
        title: (r.title ?? '').trim(),
        url: r.url as string,
        snippet: (r.content ?? '').trim(),
        source: r.engine || 'SearXNG',
      }));
    } catch { continue; }
  }
  return [];
}

// ─── Tool entry ─────────────────────────────────────────────────────────────

export const toolDefinition: ToolDefinition = {
  name: 'web-search',
  description:
    'Search the web (zero API key). Combines DuckDuckGo Instant Answer, ' +
    'Google News RSS, Wikipedia, and SearXNG for broad coverage.',
  parameters: {
    query: { type: 'string', description: 'Search query', required: true },
    maxResults: { type: 'number', description: 'Max results (default 5)' },
  },
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params.query as string | undefined;
    if (!query || typeof query !== 'string' || !query.trim())
      return { success: false, error: 'Missing required parameter: query' };
    const max = typeof params.maxResults === 'number' ? params.maxResults : 5;
    const errors: string[] = [];

    // Tier 1: DDG IA + Google News in parallel (fast, authoritative)
    let merged: SearchResult[] = [];
    try {
      const [ddg, news] = await Promise.all([
        searchDdgIA(query).catch(e => { errors.push(`ddg-ia: ${e}`); return [] as SearchResult[]; }),
        searchGoogleNews(query).catch(e => { errors.push(`gnews: ${e}`); return [] as SearchResult[]; }),
      ]);
      merged = [...ddg, ...news];
    } catch (e) { errors.push(`tier1: ${e}`); }

    if (merged.length > 0)
      return { success: true, data: { results: merged.slice(0, max), count: Math.min(merged.length, max), provider: 'ddg-ia+gnews' } };

    // Tier 2: Wikipedia
    try {
      const wiki = await searchWikipedia(query);
      if (wiki.length > 0)
        return { success: true, data: { results: wiki.slice(0, max), count: Math.min(wiki.length, max), provider: 'wikipedia' } };
      errors.push('wikipedia: empty');
    } catch (e) { errors.push(`wikipedia: ${e}`); }

    // Tier 3: SearXNG
    try {
      const sx = await searchSearxng(query);
      if (sx.length > 0)
        return { success: true, data: { results: sx.slice(0, max), count: Math.min(sx.length, max), provider: 'searxng' } };
      errors.push('searxng: empty');
    } catch (e) { errors.push(`searxng: ${e}`); }

    return { success: true, data: { results: [], message: 'No results found', errors } };
  },
};
