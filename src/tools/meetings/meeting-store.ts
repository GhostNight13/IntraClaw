import { randomUUID } from 'crypto';
import { getDb } from '../../db';
import type { Meeting, MeetingPlatform } from './types';

// ─── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url: string): MeetingPlatform {
  if (url.includes('zoom.us'))              return 'zoom';
  if (url.includes('meet.google.com'))      return 'google_meet';
  if (url.includes('teams.microsoft.com'))  return 'teams';
  return 'other';
}

// ─── Row → Meeting mapping ─────────────────────────────────────────────────────

interface MeetingRow {
  id: string;
  url: string;
  platform: string;
  title: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
  action_items: string;
  created_at: string;
}

function rowToMeeting(row: MeetingRow): Meeting {
  let actionItems: string[] = [];
  try {
    actionItems = JSON.parse(row.action_items) as string[];
  } catch {
    actionItems = [];
  }
  return {
    id:          row.id,
    url:         row.url,
    platform:    row.platform as MeetingPlatform,
    title:       row.title,
    status:      row.status as Meeting['status'],
    startedAt:   row.started_at,
    endedAt:     row.ended_at,
    transcript:  row.transcript,
    summary:     row.summary,
    actionItems,
    createdAt:   row.created_at,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function createMeeting(url: string, title: string, platform?: MeetingPlatform): Meeting {
  const db = getDb();
  const id = randomUUID();
  const resolvedPlatform = platform ?? detectPlatform(url);

  db.prepare(`
    INSERT INTO meetings (id, url, platform, title)
    VALUES (?, ?, ?, ?)
  `).run(id, url, resolvedPlatform, title);

  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow;
  return rowToMeeting(row);
}

export function getMeeting(id: string): Meeting | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  return row ? rowToMeeting(row) : null;
}

export function listMeetings(limit = 50): Meeting[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM meetings ORDER BY created_at DESC LIMIT ?'
  ).all(limit) as MeetingRow[];
  return rows.map(rowToMeeting);
}

export function updateMeeting(id: string, updates: Partial<Meeting>): Meeting {
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.url        !== undefined) { fields.push('url = ?');         values.push(updates.url); }
  if (updates.platform   !== undefined) { fields.push('platform = ?');    values.push(updates.platform); }
  if (updates.title      !== undefined) { fields.push('title = ?');       values.push(updates.title); }
  if (updates.status     !== undefined) { fields.push('status = ?');      values.push(updates.status); }
  if (updates.startedAt  !== undefined) { fields.push('started_at = ?');  values.push(updates.startedAt); }
  if (updates.endedAt    !== undefined) { fields.push('ended_at = ?');    values.push(updates.endedAt); }
  if (updates.transcript !== undefined) { fields.push('transcript = ?');  values.push(updates.transcript); }
  if (updates.summary    !== undefined) { fields.push('summary = ?');     values.push(updates.summary); }
  if (updates.actionItems !== undefined) {
    fields.push('action_items = ?');
    values.push(JSON.stringify(updates.actionItems));
  }

  if (fields.length === 0) {
    const existing = getMeeting(id);
    if (!existing) throw new Error(`Meeting not found: ${id}`);
    return existing;
  }

  values.push(id);
  db.prepare(`UPDATE meetings SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  if (!row) throw new Error(`Meeting not found after update: ${id}`);
  return rowToMeeting(row);
}

export function deleteMeeting(id: string): void {
  getDb().prepare('DELETE FROM meetings WHERE id = ?').run(id);
}
