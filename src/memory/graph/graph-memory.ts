import * as crypto from 'crypto';
import { getDb } from '../../db';
import { logger } from '../../utils/logger';
import type { Entity, EntityType, Relationship, RelationshipType } from './types';

function genId(): string {
  return crypto.randomBytes(8).toString('hex');
}

function now(): string {
  return new Date().toISOString();
}

// ─── Entity CRUD ───────────────────────────────────────────────────────────────

export function createEntity(type: EntityType, name: string, properties: Record<string, unknown> = {}): Entity {
  const db = getDb();
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO graph_entities (id, type, name, properties, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, type, name, JSON.stringify(properties), ts, ts);
  logger.info('Graph', `Entity created: ${type}/${name} (${id})`);
  return { id, type, name, properties, createdAt: ts, updatedAt: ts };
}

export function updateEntity(id: string, updates: Partial<Pick<Entity, 'name' | 'properties'>>): Entity | null {
  const db = getDb();
  const existing = getEntityById(id);
  if (!existing) return null;
  const name = updates.name ?? existing.name;
  const properties = updates.properties ? { ...existing.properties, ...updates.properties } : existing.properties;
  const ts = now();
  db.prepare('UPDATE graph_entities SET name = ?, properties = ?, updated_at = ? WHERE id = ?')
    .run(name, JSON.stringify(properties), ts, id);
  return { ...existing, name, properties, updatedAt: ts };
}

export function deleteEntity(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM graph_relationships WHERE from_id = ? OR to_id = ?').run(id, id);
  db.prepare('DELETE FROM graph_entities WHERE id = ?').run(id);
}

export function getEntityById(id: string): Entity | null {
  const row = getDb().prepare('SELECT * FROM graph_entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToEntity(row) : null;
}

export function listEntities(type?: EntityType, limit = 100): Entity[] {
  const db = getDb();
  const rows = type
    ? db.prepare('SELECT * FROM graph_entities WHERE type = ? ORDER BY updated_at DESC LIMIT ?').all(type, limit) as Record<string, unknown>[]
    : db.prepare('SELECT * FROM graph_entities ORDER BY updated_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
  return rows.map(rowToEntity);
}

export function searchEntities(query: string, type?: EntityType): Entity[] {
  const db = getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = type
    ? db.prepare("SELECT * FROM graph_entities WHERE type = ? AND (lower(name) LIKE ? OR lower(properties) LIKE ?) ORDER BY updated_at DESC LIMIT 50").all(type, pattern, pattern) as Record<string, unknown>[]
    : db.prepare("SELECT * FROM graph_entities WHERE lower(name) LIKE ? OR lower(properties) LIKE ? ORDER BY updated_at DESC LIMIT 50").all(pattern, pattern) as Record<string, unknown>[];
  return rows.map(rowToEntity);
}

// ─── Relationship CRUD ─────────────────────────────────────────────────────────

export function createRelationship(fromId: string, toId: string, type: RelationshipType, weight = 1.0, properties: Record<string, unknown> = {}): Relationship {
  const db = getDb();
  const id = genId();
  const ts = now();
  db.prepare(`
    INSERT INTO graph_relationships (id, from_id, to_id, type, weight, properties, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, fromId, toId, type, weight, JSON.stringify(properties), ts);
  return { id, fromId, toId, type, weight, properties, createdAt: ts };
}

export function deleteRelationship(id: string): void {
  getDb().prepare('DELETE FROM graph_relationships WHERE id = ?').run(id);
}

export function getNeighbors(entityId: string, relationTypes?: RelationshipType[]): { entity: Entity; relation: Relationship }[] {
  const db = getDb();
  let rows: Record<string, unknown>[];
  if (relationTypes && relationTypes.length > 0) {
    const placeholders = relationTypes.map(() => '?').join(',');
    rows = db.prepare(`
      SELECT e.*, r.id as rel_id, r.type as rel_type, r.weight, r.from_id, r.to_id, r.properties as rel_props, r.created_at as rel_created_at
      FROM graph_relationships r
      JOIN graph_entities e ON (e.id = r.to_id AND r.from_id = ?) OR (e.id = r.from_id AND r.to_id = ?)
      WHERE r.type IN (${placeholders})
      LIMIT 100
    `).all(entityId, entityId, ...relationTypes) as Record<string, unknown>[];
  } else {
    rows = db.prepare(`
      SELECT e.*, r.id as rel_id, r.type as rel_type, r.weight, r.from_id, r.to_id, r.properties as rel_props, r.created_at as rel_created_at
      FROM graph_relationships r
      JOIN graph_entities e ON (e.id = r.to_id AND r.from_id = ?) OR (e.id = r.from_id AND r.to_id = ?)
      LIMIT 100
    `).all(entityId, entityId) as Record<string, unknown>[];
  }

  return rows.map(row => ({
    entity: rowToEntity(row),
    relation: {
      id: row.rel_id as string,
      fromId: row.from_id as string,
      toId: row.to_id as string,
      type: row.rel_type as RelationshipType,
      weight: row.weight as number,
      properties: JSON.parse((row.rel_props as string) || '{}') as Record<string, unknown>,
      createdAt: row.rel_created_at as string,
    },
  }));
}

function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id: row.id as string,
    type: row.type as EntityType,
    name: row.name as string,
    properties: JSON.parse((row.properties as string) || '{}') as Record<string, unknown>,
    createdAt: (row.created_at as string),
    updatedAt: (row.updated_at as string),
  };
}
