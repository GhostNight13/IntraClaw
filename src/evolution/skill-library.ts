// src/evolution/skill-library.ts
// Voyager-style learned-skill library.
// Triple storage per skill: code + natural-language description + embedding vector.
// Retrieval is semantic (cosine similarity) — the agent reuses skills from past success.
import { getDb } from '../db';
import { ask } from '../ai';
import { logger } from '../utils/logger';
import { AgentTask } from '../types';
import { embed, cosineSimilarity } from './embeddings';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearnedSkill {
  id: number;
  name: string;
  version: number;
  code: string;
  description: string;
  embedding: number[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  successCount: number;
  lastUsedAt: string | null;
  tags: string[];
}

export interface LearnedSkillSummary {
  id: number;
  name: string;
  version: number;
  description: string;
  usageCount: number;
  successCount: number;
  successRate: number;
  lastUsedAt: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillMatch extends LearnedSkillSummary {
  similarity: number;
}

interface SkillRow {
  id: number;
  name: string;
  version: number;
  code: string;
  description: string;
  embedding: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  success_count: number;
  last_used_at: string | null;
  tags: string;
}

// ─── Row mapping ──────────────────────────────────────────────────────────────

function rowToSkill(row: SkillRow): LearnedSkill {
  let embedding: number[] = [];
  try {
    const parsed = JSON.parse(row.embedding) as unknown;
    if (Array.isArray(parsed)) embedding = parsed as number[];
  } catch {
    embedding = [];
  }
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags) as unknown;
    if (Array.isArray(parsed)) tags = parsed as string[];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    code: row.code,
    description: row.description,
    embedding,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: row.usage_count,
    successCount: row.success_count,
    lastUsedAt: row.last_used_at,
    tags,
  };
}

function toSummary(skill: LearnedSkill): LearnedSkillSummary {
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    usageCount: skill.usageCount,
    successCount: skill.successCount,
    successRate: skill.usageCount > 0 ? skill.successCount / skill.usageCount : 0,
    lastUsedAt: skill.lastUsedAt,
    tags: skill.tags,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
}

// ─── Description generation ───────────────────────────────────────────────────

async function generateDescription(name: string, code: string, taskContext: string): Promise<string> {
  const prompt = `Analyze this skill and write a one-paragraph natural-language description (3-4 sentences max).
Focus on WHAT the skill does and WHEN to use it — not HOW it's implemented.

SKILL NAME: ${name}

ORIGINAL TASK CONTEXT:
${taskContext.slice(0, 1500)}

SKILL CODE:
${code.slice(0, 2500)}

Reply with ONLY the description text, no preamble, no JSON, no markdown.`;

  try {
    const response = await ask({
      messages: [
        { role: 'system', content: 'You write concise, precise skill descriptions for an agent skill library.' },
        { role: 'user', content: prompt },
      ],
      maxTokens: 200,
      temperature: 0.3,
      task: AgentTask.MAINTENANCE,
      modelTier: 'fast',
    });
    return response.content.trim().replace(/^["']|["']$/g, '');
  } catch (err) {
    logger.warn('SkillLibrary', 'Description generation failed, using fallback', err instanceof Error ? err.message : err);
    return `Skill "${name}" learned from task: ${taskContext.slice(0, 200)}`;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface AddSkillOptions {
  tags?: string[];
  descriptionOverride?: string;
}

export interface AddSkillResult {
  skill: LearnedSkillSummary;
  bumpedVersion: boolean;
}

/**
 * Add a new skill (or bump an existing one's version).
 * - Generates a description via LLM (unless overridden).
 * - Computes the embedding (Ollama → OpenAI → hash fallback).
 * - Stores in SQLite.
 */
export async function addSkill(
  name: string,
  code: string,
  taskContext: string,
  options: AddSkillOptions = {},
): Promise<AddSkillResult> {
  if (!name || name.trim().length === 0) throw new Error('Skill name required');
  if (!code || code.trim().length === 0) throw new Error('Skill code required');

  const normalizedName = name.trim();
  const db = getDb();

  const existingRow = db
    .prepare(`SELECT * FROM learned_skills WHERE name = ?`)
    .get(normalizedName) as SkillRow | undefined;

  const description = options.descriptionOverride
    ?? await generateDescription(normalizedName, code, taskContext);
  const embeddingVec = await embed(`${normalizedName}. ${description}`);
  const embeddingJson = JSON.stringify(embeddingVec);
  const tagsJson = JSON.stringify(options.tags ?? []);

  if (existingRow) {
    const newVersion = existingRow.version + 1;
    db.prepare(`
      UPDATE learned_skills
         SET version = ?, code = ?, description = ?, embedding = ?, tags = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE name = ?
    `).run(newVersion, code, description, embeddingJson, tagsJson, normalizedName);

    logger.info('SkillLibrary', `Bumped skill "${normalizedName}" to v${newVersion}`);
    const refreshed = db
      .prepare(`SELECT * FROM learned_skills WHERE name = ?`)
      .get(normalizedName) as SkillRow;
    return { skill: toSummary(rowToSkill(refreshed)), bumpedVersion: true };
  }

  db.prepare(`
    INSERT INTO learned_skills (name, version, code, description, embedding, tags)
    VALUES (?, 1, ?, ?, ?, ?)
  `).run(normalizedName, code, description, embeddingJson, tagsJson);

  logger.info('SkillLibrary', `Added new skill "${normalizedName}" (embedding dim=${embeddingVec.length})`);
  const row = db
    .prepare(`SELECT * FROM learned_skills WHERE name = ?`)
    .get(normalizedName) as SkillRow;
  return { skill: toSummary(rowToSkill(row)), bumpedVersion: false };
}

/**
 * Semantic search: return top-k skills ranked by cosine similarity to `query`.
 */
export async function findRelevant(query: string, k = 5): Promise<SkillMatch[]> {
  if (!query || query.trim().length === 0) return [];
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM learned_skills`).all() as SkillRow[];
  if (rows.length === 0) return [];

  const queryEmbedding = await embed(query);
  const scored: SkillMatch[] = rows
    .map(r => rowToSkill(r))
    .map(skill => ({
      ...toSummary(skill),
      similarity: cosineSimilarity(queryEmbedding, skill.embedding),
    }))
    .filter(m => m.similarity > 0);

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, Math.max(0, k));
}

/**
 * Get a specific skill by name (includes code + embedding).
 */
export function getSkill(name: string): LearnedSkill | null {
  const row = getDb()
    .prepare(`SELECT * FROM learned_skills WHERE name = ?`)
    .get(name.trim()) as SkillRow | undefined;
  return row ? rowToSkill(row) : null;
}

/**
 * Record a usage of a skill. If `success` is true, also bumps success_count.
 */
export function recordUsage(name: string, success: boolean): void {
  const db = getDb();
  const result = db.prepare(`
    UPDATE learned_skills
       SET usage_count   = usage_count + 1,
           success_count = success_count + ?,
           last_used_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE name = ?
  `).run(success ? 1 : 0, name.trim());

  if (result.changes > 0) {
    logger.info('SkillLibrary', `Used skill "${name}" (success=${success})`);
  }
}

/**
 * Delete a skill by name.
 */
export function deleteSkill(name: string): boolean {
  const result = getDb()
    .prepare(`DELETE FROM learned_skills WHERE name = ?`)
    .run(name.trim());
  if (result.changes > 0) {
    logger.info('SkillLibrary', `Deleted skill "${name}"`);
    return true;
  }
  return false;
}

/**
 * List all learned skills (summary, no embeddings) for dashboard display.
 */
export function listAll(): LearnedSkillSummary[] {
  const rows = getDb()
    .prepare(`SELECT * FROM learned_skills ORDER BY usage_count DESC, created_at DESC`)
    .all() as SkillRow[];
  return rows.map(r => toSummary(rowToSkill(r)));
}

/**
 * Count of stored skills (cheap metric for the loop).
 */
export function countSkills(): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM learned_skills`)
    .get() as { n: number };
  return row.n;
}

// Namespace export — convenient single-import usage from integration points.
export const skillLibrary = {
  addSkill,
  findRelevant,
  getSkill,
  recordUsage,
  deleteSkill,
  listAll,
  countSkills,
};
