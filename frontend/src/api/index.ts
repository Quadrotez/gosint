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
