import * as crypto from 'crypto';
import { getDb } from '../db';
import { MarketplaceSkill, PublishRequest, GenericSkill, UserSkillRow } from './types';
import { emailResponder }    from './skills/email-responder';
import { blogWriter }        from './skills/blog-writer';
import { invoiceCreator }    from './skills/invoice-creator';
import { meetingSummarizer } from './skills/meeting-summarizer';
import { calendarScheduler } from './skills/calendar-scheduler';

// ─── Generic Skills Registry (5 built-in installable skills) ──────────────

export const GENERIC_SKILLS: GenericSkill[] = [
  emailResponder,
  blogWriter,
  invoiceCreator,
  meetingSummarizer,
  calendarScheduler,
];

const GENERIC_SKILL_INDEX: Record<string, GenericSkill> = Object.fromEntries(
  GENERIC_SKILLS.map(s => [s.id, s]),
);

export function listGenericSkills(): GenericSkill[] {
  return GENERIC_SKILLS;
}

export function getGenericSkill(id: string): GenericSkill | null {
  return GENERIC_SKILL_INDEX[id] ?? null;
}

export function migrateUserSkills(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_skills (
      user_id     TEXT NOT NULL,
      skill_id    TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      config      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (user_id, skill_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id, enabled);
  `);
}

export function installUserSkill(userId: string, skillId: string, config: Record<string, unknown> = {}): void {
  if (!getGenericSkill(skillId)) throw new Error(`Unknown skill: ${skillId}`);
  migrateUserSkills();
  getDb().prepare(`
    INSERT INTO user_skills (user_id, skill_id, enabled, config) VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id, skill_id) DO UPDATE SET enabled = 1, config = excluded.config
  `).run(userId, skillId, JSON.stringify(config));
}

export function uninstallUserSkill(userId: string, skillId: string): void {
  migrateUserSkills();
  getDb().prepare(`DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?`).run(userId, skillId);
}

export function listUserSkills(userId: string): UserSkillRow[] {
  migrateUserSkills();
  return getDb().prepare(`SELECT * FROM user_skills WHERE user_id = ?`).all(userId) as UserSkillRow[];
}

// ─── Beta Waitlist ────────────────────────────────────────────────────────

export interface WaitlistRow {
  id:         number;
  email:      string;
  source:     string;
  created_at: string;
}

export function migrateWaitlist(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL UNIQUE,
      source     TEXT NOT NULL DEFAULT 'unknown',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at DESC);
  `);
  // Best-effort: add source column if pre-existing table predates this field.
  try {
    db.exec(`ALTER TABLE waitlist ADD COLUMN source TEXT NOT NULL DEFAULT 'unknown'`);
  } catch {
    // already exists
  }
}

export function addToWaitlist(email: string, source = 'landing'): { ok: boolean; alreadyExists?: boolean } {
  migrateWaitlist();
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    throw new Error('Invalid email');
  }
  try {
    getDb().prepare(`INSERT INTO waitlist (email, source) VALUES (?, ?)`).run(trimmed, source);
    return { ok: true };
  } catch (e) {
    if ((e as Error).message.includes('UNIQUE')) return { ok: true, alreadyExists: true };
    throw e;
  }
}

export function listWaitlist(limit = 500): WaitlistRow[] {
  migrateWaitlist();
  return getDb().prepare(
    `SELECT * FROM waitlist ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as WaitlistRow[];
}

export function migrateMarketplace(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_skills (
      id          TEXT PRIMARY KEY,
      author_id   TEXT NOT NULL,
      author_name TEXT NOT NULL,
      name        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      version     TEXT NOT NULL,
      content     TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      downloads   INTEGER NOT NULL DEFAULT 0,
      avg_rating  REAL    NOT NULL DEFAULT 0,
      published   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS skill_ratings (
      id          TEXT PRIMARY KEY,
      skill_id    TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      score       INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(skill_id, user_id),
      FOREIGN KEY(skill_id) REFERENCES marketplace_skills(id)
    );

    CREATE INDEX IF NOT EXISTS idx_msk_slug      ON marketplace_skills(slug);
    CREATE INDEX IF NOT EXISTS idx_msk_rating    ON marketplace_skills(avg_rating DESC);
    CREATE INDEX IF NOT EXISTS idx_msk_downloads ON marketplace_skills(downloads DESC);
  `);
}

export function listSkills(opts?: {
  tags?: string; sort?: 'rating' | 'downloads' | 'newest'; limit?: number; offset?: number;
}): MarketplaceSkill[] {
  const db = getDb();
  const { sort = 'rating', limit = 20, offset = 0 } = opts ?? {};
  const orderBy =
    sort === 'rating'    ? 'avg_rating DESC' :
    sort === 'downloads' ? 'downloads DESC'  :
                           'created_at DESC';

  let query = `SELECT * FROM marketplace_skills WHERE published = 1`;
  const params: unknown[] = [];

  if (opts?.tags) {
    query += ` AND tags LIKE ?`;
    params.push(`%${opts.tags}%`);
  }

  query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params) as MarketplaceSkill[];
}

export function getSkillBySlug(slug: string): MarketplaceSkill | null {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM marketplace_skills WHERE slug = ? AND published = 1`
  ).get(slug) as MarketplaceSkill | null;
}

export function publishSkill(
  authorId: string,
  authorName: string,
  req: PublishRequest,
): MarketplaceSkill {
  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO marketplace_skills (id, author_id, author_name, name, slug, description, version, content, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, authorId, authorName,
    req.name, req.slug, req.description,
    req.version, req.content, JSON.stringify(req.tags),
  );

  return getSkillBySlug(req.slug)!;
}

export function rateSkill(
  skillId: string,
  userId: string,
  score: number,
  comment?: string,
): void {
  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(`
    INSERT INTO skill_ratings (id, skill_id, user_id, score, comment) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(skill_id, user_id) DO UPDATE SET score = excluded.score, comment = excluded.comment
  `).run(id, skillId, userId, score, comment ?? null);

  const avg = db.prepare(
    `SELECT AVG(score) as avg FROM skill_ratings WHERE skill_id = ?`
  ).get(skillId) as { avg: number };
  db.prepare(`UPDATE marketplace_skills SET avg_rating = ? WHERE id = ?`).run(avg.avg, skillId);
}

export function installSkill(slug: string): { content: string; slug: string } {
  const db = getDb();
  const skill = getSkillBySlug(slug);
  if (!skill) throw new Error(`Skill not found: ${slug}`);

  db.prepare(`UPDATE marketplace_skills SET downloads = downloads + 1 WHERE slug = ?`).run(slug);
  return { content: skill.content, slug };
}

export function getMySkills(authorId: string): MarketplaceSkill[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM marketplace_skills WHERE author_id = ? ORDER BY created_at DESC`
  ).all(authorId) as MarketplaceSkill[];
}
