export interface FieldDefinition {
  name: string;
  label_en: string;
  label_ru?: string;
  field_type: 'text' | 'date' | 'url' | 'number' | 'entity' | 'entities';
  required: boolean;
  entity_type_filter?: string; // optional filter for entity field type
}

export interface RelationshipTypeSchema {
  id: string;
  name: string;
  label_en: string;
  label_ru?: string;
  description?: string | null;
  emoji?: string | null;
  color?: string | null;
  fields?: FieldDefinition[];
  is_bidirectional: boolean;
  is_builtin: boolean;
  created_at: string;
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
  notes?: string | null;
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
  notes?: string | null;
}

export interface GraphNode {
  id: string;
  type: string;
  value: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
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

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email?: string | null;
  is_admin: boolean;
  is_active: boolean;
  session_lifetime_hours: number;
  memory_limit_mb?: number | null;
  created_at: string;
  last_login?: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface StorageInfo {
  used_bytes: number;
  used_mb: number;
  limit_mb: number;
  percent: number;
}

export interface SiteSettings {
  default_language: string;
  default_memory_limit_mb: number;
  site_icon_b64?: string | null;
  site_title: string;
  registration_enabled: boolean;
  max_accounts_per_ip: number;
  open_search_enabled: boolean;
}

export interface EntityGroup {
  id: string;
  name: string;
  description?: string | null;
  entity_ids: string[];
  is_published: boolean;
  is_imported: boolean;
  source_published_group_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishedEntityOut {
  id: string;
  published_entity_id?: string | null;
  type: string;
  value: string;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  is_masked: boolean;
}

export interface PublishedGroupOut {
  id: string;
  group_id: string;
  group_name: string;
  group_description?: string | null;
  publisher_username: string;
  published_at: string;
  entities: PublishedEntityOut[];
}

export interface AdminUser extends User {
  storage_bytes: number;
  storage_mb: number;
  registration_ip?: string | null;
}
