import axios from 'axios';
import type {
  Entity, EntityCreate, Relationship, RelationshipCreate,
  RelationshipWithEntities, GraphData, StatsData,
  EntityTypeSchema, EntityTypeSchemaCreate, EntityTypeSchemaUpdate,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Entity Type Schemas
export const getEntitySchemas = () =>
  api.get<EntityTypeSchema[]>('/entity-schemas').then(r => r.data);

export const createEntitySchema = (data: EntityTypeSchemaCreate) =>
  api.post<EntityTypeSchema>('/entity-schemas', data).then(r => r.data);

export const updateEntitySchema = (id: string, data: EntityTypeSchemaUpdate) =>
  api.put<EntityTypeSchema>(`/entity-schemas/${id}`, data).then(r => r.data);

export const deleteEntitySchema = (id: string) =>
  api.delete(`/entity-schemas/${id}`);

// Entities
export const getEntities = (params?: { skip?: number; limit?: number; type?: string }) =>
  api.get<Entity[]>('/entities', { params }).then(r => r.data);

export const getEntity = (id: string) =>
  api.get<Entity>(`/entities/${id}`).then(r => r.data);

export const createEntity = (data: EntityCreate) =>
  api.post<Entity>('/entities', data).then(r => r.data);

export const updateEntity = (id: string, data: Partial<EntityCreate>) =>
  api.put<Entity>(`/entities/${id}`, data).then(r => r.data);

export const deleteEntity = (id: string) =>
  api.delete(`/entities/${id}`);

export const getEntityRelationships = (id: string) =>
  api.get<RelationshipWithEntities[]>(`/entities/${id}/relationships`).then(r => r.data);

export const getEntityGraph = (id: string, depth?: number) =>
  api.get<GraphData>(`/entities/${id}/graph`, { params: { depth } }).then(r => r.data);

// Relationships
export const getRelationships = (params?: { skip?: number; limit?: number }) =>
  api.get<Relationship[]>('/relationships', { params }).then(r => r.data);

export const createRelationship = (data: RelationshipCreate) =>
  api.post<Relationship>('/relationships', data).then(r => r.data);

export const deleteRelationship = (id: string) =>
  api.delete(`/relationships/${id}`);

// Search
export const searchEntities = (q: string, limit?: number) =>
  api.get<Entity[]>('/search', { params: { q, limit } }).then(r => r.data);

// Stats
export const getStats = () =>
  api.get<StatsData>('/stats').then(r => r.data);

// Import
export const importCSV = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<Entity[]>('/import/csv', form).then(r => r.data);
};
