import { getDb } from '../../db';
import { getEntityById, getNeighbors } from './graph-memory';
import type { Entity, Graph } from './types';

export function findPath(fromId: string, toId: string, maxDepth = 3): Entity[] {
  // BFS
  const visited = new Set<string>();
  const queue: { id: string; path: Entity[] }[] = [{ id: fromId, path: [] }];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const entity = getEntityById(id);
    if (!entity) continue;
    const newPath = [...path, entity];

    if (id === toId) return newPath;
    if (newPath.length >= maxDepth) continue;

    const neighbors = getNeighbors(id);
    for (const { entity: neighbor } of neighbors) {
      if (!visited.has(neighbor.id)) {
        queue.push({ id: neighbor.id, path: newPath });
      }
    }
  }
  return [];
}

export function extractSubgraph(centerEntityId: string, depth = 2): Graph {
  const entities = new Map<string, Entity>();
  const relationships: import('./types').Relationship[] = [];

  function expand(id: string, currentDepth: number): void {
    if (currentDepth > depth) return;
    const entity = getEntityById(id);
    if (!entity || entities.has(id)) return;
    entities.set(id, entity);

    const neighbors = getNeighbors(id);
    for (const { entity: neighbor, relation } of neighbors) {
      relationships.push(relation);
      expand(neighbor.id, currentDepth + 1);
    }
  }

  expand(centerEntityId, 0);
  return { entities: [...entities.values()], relationships };
}

export function getGraphStats(): { entityCount: number; relationshipCount: number; topEntities: { name: string; connections: number }[] } {
  const db = getDb();
  const entityCount = (db.prepare('SELECT COUNT(*) as c FROM graph_entities').get() as { c: number }).c;
  const relationshipCount = (db.prepare('SELECT COUNT(*) as c FROM graph_relationships').get() as { c: number }).c;
  const topEntities = db.prepare(`
    SELECT e.name, COUNT(r.id) as connections
    FROM graph_entities e
    LEFT JOIN graph_relationships r ON r.from_id = e.id OR r.to_id = e.id
    GROUP BY e.id ORDER BY connections DESC LIMIT 10
  `).all() as { name: string; connections: number }[];
  return { entityCount, relationshipCount, topEntities };
}
