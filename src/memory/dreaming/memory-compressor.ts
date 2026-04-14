/**
 * INTRACLAW -- Memory Compressor
 * Compresse les vieux souvenirs (> N jours) en resumes
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ConsolidatedMemory } from './types';
import { getRecentActions } from '../../db';

const COMPRESSED_FILE = path.join(process.cwd(), 'data', 'compressed-memories.json');

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] \u{1F4A4} [MemCompressor] ${msg}`);
}

export async function compressOldMemories(olderThanDays: number): Promise<number> {
  // Recupere les actions des 30 derniers jours pour identifier les vieilles
  const allActions = getRecentActions(30 * 24 * 60);
  const cutoff     = new Date(Date.now() - olderThanDays * 86400000);
  const oldActions = allActions.filter((a: any) => new Date(a.created_at || a.createdAt) < cutoff);

  if (oldActions.length === 0) {
    log('Aucun souvenir a compresser');
    return 0;
  }

  // Groupe par semaine
  const weekGroups = groupByWeek(oldActions);
  const compressed: ConsolidatedMemory[] = loadCompressed();

  for (const [weekKey, actions] of Object.entries(weekGroups)) {
    // Skip si deja compresse
    if (compressed.find(c => c.period === weekKey)) continue;

    const summary = summarizeWeek(actions);
    compressed.push({
      period:   weekKey,
      summary,
      keyFacts: extractKeyFacts(actions),
      score:    calculateImportance(actions),
    });
  }

  // Sauvegarde
  const dir = path.dirname(COMPRESSED_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(COMPRESSED_FILE, JSON.stringify(compressed, null, 2));

  const count = Object.keys(weekGroups).length;
  log(`${count} semaines compressees, ${oldActions.length} actions resumees`);
  return oldActions.length;
}

function groupByWeek(actions: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const a of actions) {
    const date = new Date(a.created_at || a.createdAt || a.timestamp || Date.now());
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const key = `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return groups;
}

function summarizeWeek(actions: any[]): string {
  const success = actions.filter((a: any) => a.status === 'success').length;
  const types   = [...new Set(actions.map((a: any) => a.task || 'unknown'))];
  return `${actions.length} actions (${success} reussies). Types : ${types.join(', ')}.`;
}

function extractKeyFacts(actions: any[]): string[] {
  const facts: string[] = [];
  const successRate = actions.filter((a: any) => a.status === 'success').length / actions.length;
  facts.push(`Taux de reussite : ${(successRate * 100).toFixed(0)}%`);

  const types = [...new Set(actions.map((a: any) => a.task || 'unknown'))];
  facts.push(`Types d'activite : ${types.join(', ')}`);

  return facts;
}

function calculateImportance(actions: any[]): number {
  const successRate = actions.filter((a: any) => a.status === 'success').length / Math.max(actions.length, 1);
  const volumeScore = Math.min(actions.length / 50, 1);
  return (successRate * 0.6 + volumeScore * 0.4);
}

function loadCompressed(): ConsolidatedMemory[] {
  if (!fs.existsSync(COMPRESSED_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(COMPRESSED_FILE, 'utf-8'));
  } catch {
    return [];
  }
}
