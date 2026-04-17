/**
 * Generic Skill: Meeting Summarizer
 * Takes a transcript, returns bullet summary + action items, queues them for the next Ouroboros tick.
 */
import * as crypto from 'crypto';
import { GenericSkill, SkillContext, SkillResult } from '../types';
import { ask } from '../../ai';
import { getDb } from '../../db';
import { logger } from '../../utils/logger';

interface MeetingSummarizerConfig {
  language?: 'en' | 'fr' | 'es';
  maxBullets?: number;
}

interface MeetingSummarizerInput {
  transcript: string;
  meetingTitle?: string;
}

interface ActionItem {
  task:    string;
  owner?:  string;
  due?:    string;
}

interface SummaryPayload {
  summary:     string[];
  actionItems: ActionItem[];
}

function ensureQueueTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_loop_tasks (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      source      TEXT NOT NULL,
      task        TEXT NOT NULL,
      metadata    TEXT NOT NULL DEFAULT '{}',
      status      TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed','failed')),
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pending_user_status ON pending_loop_tasks(user_id, status);
  `);
}

function enqueueForNextTick(userId: string, source: string, task: string, metadata: Record<string, unknown>): string {
  ensureQueueTable();
  const id = crypto.randomUUID();
  getDb().prepare(`
    INSERT INTO pending_loop_tasks (id, user_id, source, task, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, source, task, JSON.stringify(metadata));
  return id;
}

export const meetingSummarizer: GenericSkill = {
  id:          'meeting-summarizer',
  name:        'Meeting Summarizer',
  description: 'Summarizes a meeting transcript into bullets + action items, queued for the next Ouroboros tick.',
  icon:        'Mic',
  tier:        'free',
  requires:    [],

  async execute(ctx: SkillContext, input: Record<string, unknown>): Promise<SkillResult> {
    const cfg = ctx.config as MeetingSummarizerConfig;
    const data = input as unknown as MeetingSummarizerInput;

    if (!data.transcript || data.transcript.trim().length < 30) {
      return { ok: false, error: 'Missing input: transcript (min 30 chars)' };
    }

    try {
      const lang = cfg.language ?? 'en';
      const max  = cfg.maxBullets ?? 7;

      const prompt = [
        `You are a meeting analyst. Language: ${lang}.`,
        `Read the transcript and produce STRICT JSON with this shape:`,
        `{"summary":["bullet 1", ...],"actionItems":[{"task":"...","owner":"name or null","due":"YYYY-MM-DD or null"}, ...]}`,
        `Rules: max ${max} summary bullets, each <= 25 words. Action items must be concrete and actionable.`,
        `Output ONLY the JSON, no prose.`,
        `--- TRANSCRIPT ---`,
        data.transcript.slice(0, 16_000),
      ].join('\n');

      const response = await ask({
        messages: [{ role: 'user', content: prompt }],
        modelTier: 'balanced',
        maxTokens: 1500,
      });

      const raw = response.content.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { ok: false, error: 'Model did not return JSON' };
      }

      let parsed: SummaryPayload;
      try {
        parsed = JSON.parse(jsonMatch[0]) as SummaryPayload;
      } catch (e) {
        return { ok: false, error: `Invalid JSON from model: ${(e as Error).message}` };
      }

      const summary     = Array.isArray(parsed.summary)     ? parsed.summary.slice(0, max) : [];
      const actionItems = Array.isArray(parsed.actionItems) ? parsed.actionItems            : [];

      // Queue each action item for the next Ouroboros tick
      const queuedIds: string[] = [];
      for (const item of actionItems) {
        if (!item.task) continue;
        const id = enqueueForNextTick(ctx.userId, 'meeting-summarizer', item.task, {
          owner:        item.owner ?? null,
          due:          item.due ?? null,
          meetingTitle: data.meetingTitle ?? null,
        });
        queuedIds.push(id);
      }

      return {
        ok: true,
        message: `Summary generated (${summary.length} bullets, ${queuedIds.length} action items queued).`,
        data: { summary, actionItems, queuedTaskIds: queuedIds },
      };
    } catch (err) {
      logger.error('Skill:meeting-summarizer', err instanceof Error ? err.message : String(err));
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
