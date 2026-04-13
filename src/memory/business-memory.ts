// src/memory/business-memory.ts
import * as fs from 'fs';
import * as path from 'path';
import { storeMemory, searchMemory, isVectorMemoryAvailable } from './vector-memory';
import { logger } from '../utils/logger';

const BIZ_MEMORY_PATH = path.resolve(process.cwd(), 'data', 'business-memory.json');

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectorInsight {
  sector: string;             // "horeca", "immobilier", etc.
  responseRate: number;       // Historical average %
  conversionRate: number;
  bestEmailTone: string;
  bestLanguage: string;
  sampleSize: number;         // How many data points
  lastUpdated: string;
  notes: string[];
}

interface EmailPattern {
  tone: string;               // "direct", "formel", "conversationnel"
  language: string;           // "fr", "nl"
  sector: string;
  responseRate: number;
  sampleSize: number;
  lastUpdated: string;
}

interface ContentInsight {
  topic: string;
  engagementScore: number;    // 0-10
  publishCount: number;
  lastPublished: string;
  notes: string[];
}

interface ProspectInsight {
  region: string;
  sector: string;
  hasWebsite: boolean;
  responseRate: number;
  count: number;
}

export interface BusinessMemoryState {
  sectors: SectorInsight[];
  emailPatterns: EmailPattern[];
  contentInsights: ContentInsight[];
  prospectInsights: ProspectInsight[];
  generalLearnings: Array<{
    date: string;
    insight: string;
    source: string;          // "strategy-evolver", "cold-email", "prospection"
    confidence: number;      // 0-1
  }>;
  lastUpdated: string;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadState(): BusinessMemoryState {
  try {
    if (fs.existsSync(BIZ_MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(BIZ_MEMORY_PATH, 'utf8')) as BusinessMemoryState;
    }
  } catch {
    // ignore parse errors — return default
  }
  return getDefaultState();
}

function saveState(state: BusinessMemoryState): void {
  const dir = path.dirname(BIZ_MEMORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(BIZ_MEMORY_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function getDefaultState(): BusinessMemoryState {
  return {
    sectors: [
      { sector: 'horeca', responseRate: 0, conversionRate: 0, bestEmailTone: 'direct', bestLanguage: 'fr', sampleSize: 0, lastUpdated: new Date().toISOString(), notes: [] },
      { sector: 'commerce-detail', responseRate: 0, conversionRate: 0, bestEmailTone: 'direct', bestLanguage: 'fr', sampleSize: 0, lastUpdated: new Date().toISOString(), notes: [] },
      { sector: 'sante', responseRate: 0, conversionRate: 0, bestEmailTone: 'formel', bestLanguage: 'fr', sampleSize: 0, lastUpdated: new Date().toISOString(), notes: [] },
      { sector: 'immobilier', responseRate: 0, conversionRate: 0, bestEmailTone: 'formel', bestLanguage: 'fr', sampleSize: 0, lastUpdated: new Date().toISOString(), notes: [] },
    ],
    emailPatterns: [],
    contentInsights: [],
    prospectInsights: [],
    generalLearnings: [],
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a business learning (from any agent).
 */
export async function recordBusinessLearning(params: {
  insight: string;
  source: string;
  confidence?: number;
  sector?: string;
}): Promise<void> {
  const state = loadState();

  state.generalLearnings.push({
    date: new Date().toISOString(),
    insight: params.insight,
    source: params.source,
    confidence: params.confidence ?? 0.5,
  });

  // Keep last 100 learnings
  if (state.generalLearnings.length > 100) {
    state.generalLearnings = state.generalLearnings.slice(-100);
  }

  saveState(state);

  // Also store in vector memory for semantic search
  if (isVectorMemoryAvailable()) {
    await storeMemory({
      content: params.insight,
      category: 'business_learning',
      source: params.source,
      metadata: {
        confidence: params.confidence ?? 0.5,
        ...(params.sector ? { sector: params.sector } : {}),
      },
    }).catch(() => {});
  }

  logger.info('BusinessMemory', `Learning recorded: ${params.insight.slice(0, 80)}`);
}

/**
 * Update sector metrics after email campaign.
 */
export function updateSectorMetrics(params: {
  sector: string;
  emailsSent: number;
  replies: number;
  conversions: number;
  emailTone: string;
  language: string;
}): void {
  const state = loadState();

  let sectorInsight = state.sectors.find(s => s.sector === params.sector);
  if (!sectorInsight) {
    sectorInsight = {
      sector: params.sector,
      responseRate: 0,
      conversionRate: 0,
      bestEmailTone: params.emailTone,
      bestLanguage: params.language,
      sampleSize: 0,
      lastUpdated: new Date().toISOString(),
      notes: [],
    };
    state.sectors.push(sectorInsight);
  }

  // Weighted moving average
  const oldWeight = sectorInsight.sampleSize;
  const newWeight = params.emailsSent;
  const totalWeight = oldWeight + newWeight;

  if (totalWeight > 0) {
    const newResponseRate = params.emailsSent > 0 ? (params.replies / params.emailsSent) * 100 : 0;
    sectorInsight.responseRate = (sectorInsight.responseRate * oldWeight + newResponseRate * newWeight) / totalWeight;

    const newConversionRate = params.replies > 0 ? (params.conversions / params.replies) * 100 : 0;
    sectorInsight.conversionRate = (sectorInsight.conversionRate * oldWeight + newConversionRate * newWeight) / totalWeight;
  }

  sectorInsight.sampleSize += params.emailsSent;
  sectorInsight.lastUpdated = new Date().toISOString();

  // Track best performing tone/language
  if (params.replies > 0) {
    sectorInsight.bestEmailTone = params.emailTone;
    sectorInsight.bestLanguage = params.language;
  }

  saveState(state);
  logger.info('BusinessMemory', `Sector updated: ${params.sector} (${sectorInsight.responseRate.toFixed(1)}% response rate)`);
}

/**
 * Record a content performance insight.
 */
export function recordContentPerformance(params: {
  topic: string;
  engagementScore: number;
}): void {
  const state = loadState();

  let content = state.contentInsights.find(c => c.topic === params.topic);
  if (!content) {
    content = {
      topic: params.topic,
      engagementScore: params.engagementScore,
      publishCount: 1,
      lastPublished: new Date().toISOString(),
      notes: [],
    };
    state.contentInsights.push(content);
  } else {
    content.engagementScore = (content.engagementScore * content.publishCount + params.engagementScore) / (content.publishCount + 1);
    content.publishCount++;
    content.lastPublished = new Date().toISOString();
  }

  saveState(state);
}

/**
 * Get the best performing sectors (sorted by response rate).
 */
export function getBestSectors(limit = 5): SectorInsight[] {
  const state = loadState();
  return state.sectors
    .filter(s => s.sampleSize >= 5)
    .sort((a, b) => b.responseRate - a.responseRate)
    .slice(0, limit);
}

/**
 * Get the best performing email pattern for a given sector.
 */
export function getBestEmailPattern(sector: string): { tone: string; language: string } | null {
  const state = loadState();
  const sectorInsight = state.sectors.find(s => s.sector === sector);
  if (!sectorInsight || sectorInsight.sampleSize < 3) return null;
  return {
    tone: sectorInsight.bestEmailTone,
    language: sectorInsight.bestLanguage,
  };
}

/**
 * Get best content topics (sorted by engagement).
 */
export function getBestContentTopics(limit = 5): ContentInsight[] {
  const state = loadState();
  return state.contentInsights
    .filter(c => c.publishCount >= 2)
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, limit);
}

/**
 * Search business memory semantically (requires ChromaDB).
 */
export async function searchBusinessInsights(query: string): Promise<string[]> {
  if (!isVectorMemoryAvailable()) {
    // Fallback: search generalLearnings by keyword
    const state = loadState();
    const lower = query.toLowerCase();
    return state.generalLearnings
      .filter(l => l.insight.toLowerCase().includes(lower))
      .map(l => l.insight)
      .slice(0, 5);
  }

  const results = await searchMemory(query, {
    maxResults: 5,
    category: 'business_learning',
  });

  return results.map(r => r.content);
}

/**
 * Get a summary of business memory for injection into prompts.
 */
export function getBusinessMemorySummary(): string {
  const state = loadState();
  const bestSectors = getBestSectors(3);
  const bestTopics = getBestContentTopics(3);
  const recentLearnings = state.generalLearnings.slice(-5);

  const lines: string[] = ['BUSINESS MEMORY :'];

  if (bestSectors.length > 0) {
    lines.push('Secteurs performants :');
    for (const s of bestSectors) {
      lines.push(`  - ${s.sector}: ${s.responseRate.toFixed(1)}% réponse, ton=${s.bestEmailTone}, lang=${s.bestLanguage} (${s.sampleSize} emails)`);
    }
  }

  if (bestTopics.length > 0) {
    lines.push('Topics LinkedIn performants :');
    for (const t of bestTopics) {
      lines.push(`  - ${t.topic}: score ${t.engagementScore.toFixed(1)}/10 (${t.publishCount} posts)`);
    }
  }

  if (recentLearnings.length > 0) {
    lines.push('Derniers apprentissages :');
    for (const l of recentLearnings) {
      lines.push(`  - [${l.date.slice(0, 10)}] ${l.insight}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get full state for API/dashboard.
 */
export function getBusinessMemoryState(): BusinessMemoryState {
  return loadState();
}
