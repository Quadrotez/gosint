export interface FieldDefinition {
  name: string;
  label_en: string;
  label_ru?: string;
  field_type: 'text' | 'date' | 'url' | 'number';
  required: boolean;
}

export interface EntityTypeSchema {
  id: string;
  name: string;
  label_en: string;
  label_ru?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
  is_builtin: boolean;
  created_at: string;
}

export interface EntityTypeSchemaCreate {
  name: string;
  label_en: string;
  label_ru?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
}

export interface EntityTypeSchemaUpdate {
  label_en?: string;
  label_ru?: string;
  icon?: string;
  color?: string;
  fields?: FieldDefinition[];
}

export interface Entity {
  id: string;
  type: string;
  value: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  canvas_layout?: Record<string, unknown> | null;
  created_at: string;
}

export interface EntityCreate {
  type: string;
  value: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface Relationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface RelationshipWithEntities extends Relationship {
  source_entity?: Entity;
  target_entity?: Entity;
}

export interface RelationshipCreate {
  source_entity_id: string;
  target_entity_id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

export interface GraphNode {
  id: string;
  type: string;
  value: string;
  metadata?: Record<string, unknown> | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface StatsData {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  recent_entities: Entity[];
}
