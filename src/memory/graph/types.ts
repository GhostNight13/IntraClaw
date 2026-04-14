export type EntityType = 'person' | 'company' | 'project' | 'task' | 'concept' | 'tool' | 'document';
export type RelationshipType = 'works_at' | 'manages' | 'related_to' | 'caused' | 'depends_on' | 'created_by' | 'part_of' | 'uses';

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  weight: number;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface Graph {
  entities: Entity[];
  relationships: Relationship[];
}

export interface GraphPath {
  nodes: Entity[];
  edges: Relationship[];
  length: number;
}
