import axios, { type AxiosError } from 'axios';
import type {
  Entity, EntityCreate, Relationship, RelationshipCreate,
  RelationshipWithEntities, GraphData, StatsData,
  EntityTypeSchema, EntityTypeSchemaCreate, EntityTypeSchemaUpdate,
  TokenResponse, User, StorageInfo, SiteSettings, AdminUser,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Inject Bearer token on every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('osint_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Redirect to /login on 401
api.interceptors.response.use(
  r => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('osint_token');
      localStorage.removeItem('osint_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authRegister = (username: string, password: string, email?: string) =>
  api.post<TokenResponse>('/auth/register', { username, password, email }).then(r => r.data);

export const authLogin = (username: string, password: string) =>
  api.post<TokenResponse>('/auth/login', { username, password }).then(r => r.data);

export const getMe = () =>
  api.get<User>('/auth/me').then(r => r.data);

export const updateMe = (data: {
  username?: string;
  email?: string;
  password?: string;
  current_password?: string;
  session_lifetime_hours?: number;
}) => api.put<User>('/auth/me', data).then(r => r.data);

export const getMyStorage = () =>
  api.get<StorageInfo>('/auth/me/storage').then(r => r.data);

export const resetMyData = () =>
  api.delete('/auth/me/data');

export const deleteMyAccount = () =>
  api.delete('/auth/me');

// ── Public site settings (login page) ────────────────────────────────────────

export const getPublicSettings = () =>
  api.get<SiteSettings>('/admin/settings/public').then(r => r.data);

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminGetUsers = () =>
  api.get<AdminUser[]>('/admin/users').then(r => r.data);

export const adminUpdateUser = (id: string, data: {
  is_active?: boolean;
  memory_limit_mb?: number;
  is_admin?: boolean;
  password?: string;
}) => api.put<User>(`/admin/users/${id}`, data).then(r => r.data);

export const adminDeleteUser = (id: string) =>
  api.delete(`/admin/users/${id}`);

export const adminGetSettings = () =>
  api.get<SiteSettings>('/admin/settings').then(r => r.data);

export const adminUpdateSettings = (data: Partial<SiteSettings>) =>
  api.put<SiteSettings>('/admin/settings', data).then(r => r.data);

// ── Entity Type Schemas ───────────────────────────────────────────────────────

export const getEntitySchemas = () =>
  api.get<EntityTypeSchema[]>('/entity-schemas').then(r => r.data);

export const createEntitySchema = (data: EntityTypeSchemaCreate) =>
  api.post<EntityTypeSchema>('/entity-schemas', data).then(r => r.data);

export const updateEntitySchema = (id: string, data: EntityTypeSchemaUpdate) =>
  api.put<EntityTypeSchema>(`/entity-schemas/${id}`, data).then(r => r.data);

export const deleteEntitySchema = (id: string) =>
  api.delete(`/entity-schemas/${id}`);

// ── Entities ──────────────────────────────────────────────────────────────────

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

// ── Relationships ─────────────────────────────────────────────────────────────

export const getRelationships = (params?: { skip?: number; limit?: number }) =>
  api.get<Relationship[]>('/relationships', { params }).then(r => r.data);

export const createRelationship = (data: RelationshipCreate) =>
  api.post<Relationship>('/relationships', data).then(r => r.data);

export const deleteRelationship = (id: string) =>
  api.delete(`/relationships/${id}`);

// ── Search ────────────────────────────────────────────────────────────────────

export const searchEntities = (q: string, limit?: number) =>
  api.get<Entity[]>('/search', { params: { q, limit } }).then(r => r.data);

// ── Stats ─────────────────────────────────────────────────────────────────────

export const getStats = () =>
  api.get<StatsData>('/stats').then(r => r.data);

// ── Import ────────────────────────────────────────────────────────────────────

export const importCSV = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<Entity[]>('/import/csv', form).then(r => r.data);
};

// ── Backup ────────────────────────────────────────────────────────────────────

export const exportBackup = () =>
  api.get('/backup/export', { responseType: 'blob' }).then(r => r.data as Blob);

export const importBackup = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<{ success: boolean; imported: Record<string, number> }>('/backup/import', form).then(r => r.data);
};

// ── WebDAV ────────────────────────────────────────────────────────────────────

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  filename?: string;
}

export const webdavTest = (cfg: WebDAVConfig) =>
  api.post<{ ok: boolean; status: number }>('/webdav/test', cfg).then(r => r.data);

export const webdavPush = (cfg: WebDAVConfig) =>
  api.post<{ ok: boolean; bytes: number }>('/webdav/push', cfg).then(r => r.data);

export const webdavPull = (cfg: WebDAVConfig) =>
  api.post<{ ok: boolean; merged: Record<string, number> }>('/webdav/pull', cfg).then(r => r.data);

export const webdavSync = (cfg: WebDAVConfig) =>
  api.post<{ ok: boolean; pulled: Record<string, number>; pushed_bytes: number }>('/webdav/sync', cfg).then(r => r.data);


// ── Attachments ───────────────────────────────────────────────────────────────

export interface AttachmentOut {
  id: string;
  entity_id: string;
  filename: string;
  mimetype: string;
  size_bytes: number;
  data_b64: string;
  created_at: string;
}

export async function getAttachments(entityId: string): Promise<AttachmentOut[]> {
  const r = await api.get(`/attachments/entity/${entityId}`);
  return r.data;
}

export async function uploadAttachment(entityId: string, body: {
  filename: string; mimetype: string; size_bytes: number; data_b64: string;
}): Promise<AttachmentOut> {
  const r = await api.post(`/attachments/entity/${entityId}`, body);
  return r.data;
}

export async function deleteAttachment(attId: string): Promise<void> {
  await api.delete(`/attachments/${attId}`);
}

export function getAttachmentDownloadUrl(attId: string): string {
  return `${api.defaults.baseURL}/attachments/${attId}/download`;
}

// ── Relationship notes ────────────────────────────────────────────────────────

export async function updateRelationship(relId: string, data: { notes?: string; type?: string }) {
  const r = await api.patch(`/relationships/${relId}`, data);
  return r.data;
}

// ── DB Config ─────────────────────────────────────────────────────────────────

export interface DbConfigOut {
  engine: string;
  url_display: string;
  is_sqlite: boolean;
  pending_url?: string | null;
}

export async function getDbConfig(): Promise<DbConfigOut> {
  const r = await api.get('/admin/db-config');
  return r.data;
}

export async function updateDbConfig(database_url: string): Promise<DbConfigOut> {
  const r = await api.put('/admin/db-config', { database_url });
  return r.data;
}

// ── Relationship Type Schemas ─────────────────────────────────────────────────

export async function getRelationshipTypeSchemas() {
  const r = await api.get('/relationship-types');
  return r.data;
}

export async function createRelationshipTypeSchema(data: {
  name: string; label_en: string; label_ru?: string;
  description?: string; emoji?: string; color?: string; fields?: any[];
}) {
  const r = await api.post('/relationship-types', data);
  return r.data;
}

export async function updateRelationshipTypeSchema(id: string, data: {
  label_en?: string; label_ru?: string; description?: string;
  emoji?: string; color?: string; fields?: any[];
}) {
  const r = await api.patch(`/relationship-types/${id}`, data);
  return r.data;
}

export async function deleteRelationshipTypeSchema(id: string) {
  await api.delete(`/relationship-types/${id}`);
}

// ── Entity Groups ──────────────────────────────────────────────────────────────

export async function getEntityGroups() {
  const r = await api.get('/entity-groups');
  return r.data as import('../types').EntityGroup[];
}

export async function createEntityGroup(data: { name: string; description?: string; entity_ids?: string[] }) {
  const r = await api.post('/entity-groups', data);
  return r.data as import('../types').EntityGroup;
}

export async function updateEntityGroup(id: string, data: { name?: string; description?: string; entity_ids?: string[] }) {
  const r = await api.patch(`/entity-groups/${id}`, data);
  return r.data as import('../types').EntityGroup;
}

export async function deleteEntityGroup(id: string) {
  await api.delete(`/entity-groups/${id}`);
}

export async function publishEntityGroup(id: string) {
  const r = await api.post(`/entity-groups/${id}/publish`);
  return r.data as import('../types').EntityGroup;
}

export async function unpublishEntityGroup(id: string) {
  const r = await api.delete(`/entity-groups/${id}/publish`);
  return r.data as import('../types').EntityGroup;
}

// ── Open Search ────────────────────────────────────────────────────────────────

export async function getPublishedGroups() {
  const r = await api.get('/open-search/published');
  return r.data as import('../types').PublishedGroupOut[];
}

export async function getPublishedGroupRelationships(groupId: string) {
  const r = await api.get(`/open-search/published/${groupId}/relationships`);
  return r.data as { relationships: any[] };
}

export async function importPublishedGroup(publishedGroupId: string) {
  const r = await api.post(`/open-search/published/${publishedGroupId}/import`);
  return r.data as import('../types').EntityGroup;
}

export async function importPublishedEntity(originalEntityId: string) {
  const r = await api.post(`/open-search/published/entities/${originalEntityId}/import`);
  return r.data as import('../types').EntityGroup;
}
