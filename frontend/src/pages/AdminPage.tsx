import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminGetUsers, adminUpdateUser, adminDeleteUser, adminGetSettings, adminUpdateSettings, getDbConfig, updateDbConfig, type DbConfigOut } from '../api';
import { useToast } from '../context/ToastContext';
import { useLang } from '../i18n/LangProvider';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { AdminUser } from '../types';
import { Shield, Users, Settings, Trash2, Check, X, Upload, Globe, HardDrive, RefreshCw, Database, AlertTriangle } from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLang();
  const { toast } = useToast();
  const qc = useQueryClient();
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'users' | 'settings' | 'database'>('users');
  const [dbUrl, setDbUrl] = useState('');
  const [dbSaved, setDbSaved] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [memLimit, setMemLimit] = useState<string>('');
  const [newPwd, setNewPwd] = useState('');

  if (!user?.is_admin) {
    navigate('/');
    return null;
  }

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: adminGetUsers,
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminGetSettings,
  });

  const { data: dbConfig } = useQuery<DbConfigOut>({
    queryKey: ['admin-db-config'],
    queryFn: getDbConfig,
  });

  const updateDbMut = useMutation({
    mutationFn: (url: string) => updateDbConfig(url),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-db-config'] });
      setDbSaved(true);
      setTimeout(() => setDbSaved(false), 3000);
    },
    onError: (e: unknown) => toast.error((e as any)?.response?.data?.detail || 'Error'),
  });

  const updateUserMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof adminUpdateUser>[1] }) =>
      adminUpdateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUser(null);
      setMemLimit(''); setNewPwd('');
      toast.success('Saved');
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error'),
  });

  const deleteUserMut = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User deleted'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error'),
  });

  const updateSettingsMut = useMutation({
    mutationFn: adminUpdateSettings,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); toast.success('Settings saved'); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error'),
  });

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
  const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' };

  const handleIconUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target?.result as string;
      updateSettingsMut.mutate({ site_icon_b64: b64 });
      // update browser favicon dynamically
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/png';
      link.rel = 'shortcut icon';
      link.href = b64;
      document.head.appendChild(link);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="font-mono text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {lang === 'ru' ? 'Панель администратора' : 'Admin Panel'}
        </h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
        {[
          { id: 'users', label: lang === 'ru' ? 'Пользователи' : 'Users', icon: Users },
          { id: 'settings', label: lang === 'ru' ? 'Настройки сайта' : 'Site Settings', icon: Settings },
          { id: 'database', label: lang === 'ru' ? 'База данных' : 'Database', icon: Database },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-md font-mono text-sm transition-all"
            style={{
              background: tab === t.id ? 'var(--bg-card)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: tab === t.id ? '1px solid var(--border)' : '1px solid transparent',
            }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          {usersLoading ? (
            <div className="p-8 text-center font-mono text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <table className="w-full text-sm font-mono">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Username', 'Email', 'IP', 'Storage', 'Status', 'Admin', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: AdminUser) => (
                  <>
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', background: editingUser === u.id ? 'var(--bg-secondary)' : undefined }}>
                      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                        {u.username}
                        {u.id === user.id && (
                          <span className="ml-1 text-xs px-1 rounded" style={{ background: 'var(--accent)', color: '#000' }}>you</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{u.email || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{u.registration_ip || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                        {u.storage_mb.toFixed(1)} MB
                        {u.memory_limit_mb && <span className="text-xs"> / {u.memory_limit_mb}MB</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => u.id !== user.id && updateUserMut.mutate({ id: u.id, data: { is_active: !u.is_active } })}
                          disabled={u.id === user.id}
                          className="px-2 py-0.5 rounded text-xs disabled:opacity-40"
                          style={{ background: u.is_active ? '#1a3a2a' : '#2d1515', color: u.is_active ? '#4ade80' : '#f87171' }}>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => u.id !== user.id && updateUserMut.mutate({ id: u.id, data: { is_admin: !u.is_admin } })}
                          disabled={u.id === user.id}
                          className="p-1 rounded disabled:opacity-40"
                          style={{ background: u.is_admin ? '#1e2a4a' : 'var(--bg-secondary)' }}>
                          {u.is_admin ? <Check size={13} style={{ color: 'var(--accent)' }} /> : <X size={13} style={{ color: 'var(--text-muted)' }} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingUser(editingUser === u.id ? null : u.id); setMemLimit(String(u.memory_limit_mb || '')); setNewPwd(''); }}
                            className="p-1.5 rounded text-xs font-mono"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            {editingUser === u.id ? 'Close' : 'Edit'}
                          </button>
                          {u.id !== user.id && (
                            <button
                              onClick={() => { if (confirm(`Delete user "${u.username}"?`)) deleteUserMut.mutate(u.id); }}
                              className="p-1.5 rounded"
                              style={{ background: '#2d1515', color: '#f87171' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {editingUser === u.id && (
                      <tr key={`${u.id}-edit`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                Memory limit (MB, 0 = default)
                              </label>
                              <input type="number" min={0} value={memLimit} onChange={e => setMemLimit(e.target.value)}
                                className="w-32 px-3 py-1.5 rounded-lg font-mono text-sm outline-none"
                                style={inputStyle} placeholder="e.g. 512" />
                            </div>
                            <div>
                              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>New password</label>
                              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                                className="w-40 px-3 py-1.5 rounded-lg font-mono text-sm outline-none"
                                style={inputStyle} placeholder="leave blank to keep" />
                            </div>
                            <button
                              onClick={() => {
                                const data: Parameters<typeof adminUpdateUser>[1] = {
                                  memory_limit_mb: memLimit ? Number(memLimit) : 0,
                                };
                                if (newPwd) data.password = newPwd;
                                updateUserMut.mutate({ id: u.id, data });
                              }}
                              className="px-4 py-1.5 rounded-lg font-mono text-sm"
                              style={{ background: 'var(--accent)', color: '#000' }}>
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Database tab */}
      {tab === 'database' && (
        <div className="space-y-4">
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Database size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Конфигурация базы данных' : 'Database Configuration'}
              </span>
            </div>

            {dbConfig && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Текущий движок' : 'Current engine'}
                </div>
                <div className="font-mono text-sm" style={{ color: 'var(--accent)' }}>
                  {dbConfig.engine.toUpperCase()}
                  {dbConfig.is_sqlite && <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>default</span>}
                </div>
                <div className="text-xs font-mono mt-1 break-all" style={{ color: 'var(--text-muted)' }}>{dbConfig.url_display}</div>
                {dbConfig.pending_url && (
                  <div className="mt-2 text-[10px] font-mono" style={{ color: '#ffd700' }}>
                    ⏳ {lang === 'ru' ? 'Ожидает перезапуска:' : 'Pending restart:'} {dbConfig.pending_url}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'URL подключения' : 'Connection URL'}
                </label>
                <input
                  value={dbUrl}
                  onChange={e => setDbUrl(e.target.value)}
                  placeholder="postgresql://user:pass@host:5432/dbname  |  mysql+pymysql://...  |  (пусто = SQLite)"
                  className="w-full px-3 py-2 rounded-lg font-mono text-xs outline-none"
                  style={inputStyle}
                />
                <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru'
                    ? 'Примеры: postgresql://user:pass@localhost/dbname · mysql+pymysql://user:pass@localhost/dbname · оставьте пустым для SQLite'
                    : 'Examples: postgresql://user:pass@localhost/dbname · mysql+pymysql://user:pass@localhost/dbname · empty = SQLite'}
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: '#ffd70010', border: '1px solid #ffd70030' }}>
                <AlertTriangle size={13} style={{ color: '#ffd700', flexShrink: 0 }} />
                <p className="text-[11px] font-mono" style={{ color: '#ffd700' }}>
                  {lang === 'ru'
                    ? 'Изменение вступит в силу после перезапуска сервера. Убедитесь что установлен нужный пакет (psycopg2, pymysql).'
                    : 'Change takes effect after server restart. Make sure the driver package is installed (psycopg2, pymysql).'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => updateDbMut.mutate(dbUrl)}
                  disabled={updateDbMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: '#000' }}>
                  {dbSaved ? <Check size={13} /> : <Database size={13} />}
                  {dbSaved ? (lang === 'ru' ? 'Сохранено' : 'Saved') : (lang === 'ru' ? 'Сохранить' : 'Save')}
                </button>
                {dbUrl && (
                  <button onClick={() => setDbUrl('')}
                    className="px-4 py-2 rounded-lg font-mono text-sm"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Clear
                  </button>
                )}
              </div>

              {/* Quick presets */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Быстрые шаблоны' : 'Quick templates'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'SQLite (default)', url: '' },
                    { label: 'PostgreSQL', url: 'postgresql://user:password@localhost:5432/osint_db' },
                    { label: 'MySQL', url: 'mysql+pymysql://user:password@localhost:3306/osint_db' },
                  ].map(({ label, url }) => (
                    <button key={label} onClick={() => setDbUrl(url)}
                      className="px-3 py-1.5 rounded font-mono text-xs"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && settings && (
        <div className="space-y-4">

          {/* Site identity */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Идентификация сайта' : 'Site Identity'}
              </span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Название сайта' : 'Site title'}
                </label>
                <div className="flex gap-2">
                  <input
                    key={settings.site_title}
                    defaultValue={settings.site_title}
                    onBlur={e => updateSettingsMut.mutate({ site_title: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg font-mono text-sm outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Иконка сайта (favicon)' : 'Site icon (favicon)'}
                </label>
                <div className="flex items-center gap-3">
                  {settings.site_icon_b64
                    ? <img src={settings.site_icon_b64} alt="icon" className="w-10 h-10 rounded object-contain" style={{ background: 'var(--bg-secondary)' }} />
                    : <div className="w-10 h-10 rounded flex items-center justify-center text-xl" style={{ background: 'var(--bg-secondary)' }}>🔍</div>
                  }
                  <button onClick={() => iconInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                    <Upload size={13} /> {lang === 'ru' ? 'Загрузить' : 'Upload'}
                  </button>
                  {settings.site_icon_b64 && (
                    <button onClick={() => updateSettingsMut.mutate({ site_icon_b64: '' })}
                      className="px-3 py-2 rounded-lg font-mono text-sm"
                      style={{ background: '#2d1515', color: '#f87171' }}>
                      {lang === 'ru' ? 'Удалить' : 'Remove'}
                    </button>
                  )}
                  <input ref={iconInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.target.value = ''; }} />
                </div>
              </div>
            </div>
          </div>

          {/* Registration & limits */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Регистрация' : 'Registration'}
              </span>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => updateSettingsMut.mutate({ registration_enabled: !settings.registration_enabled })}
                  className="w-10 h-5 rounded-full relative transition-colors cursor-pointer"
                  style={{ background: settings.registration_enabled ? 'var(--accent)' : 'var(--bg-secondary)' }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                    style={{ left: settings.registration_enabled ? '1.25rem' : '0.125rem' }} />
                </div>
                <span className="font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Разрешить регистрацию' : 'Allow registration'}
                </span>
              </label>
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Макс. аккаунтов с одного IP' : 'Max accounts per IP'}
                </label>
                <input type="number" min={1} max={100}
                  key={settings.max_accounts_per_ip}
                  defaultValue={settings.max_accounts_per_ip}
                  onBlur={e => updateSettingsMut.mutate({ max_accounts_per_ip: Number(e.target.value) })}
                  className="w-28 px-3 py-2 rounded-lg font-mono text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Storage & language */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={14} style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                {lang === 'ru' ? 'Хранилище и язык' : 'Storage & Language'}
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Лимит памяти по умолчанию (МБ)' : 'Default memory limit (MB)'}
                </label>
                <input type="number" min={1}
                  key={settings.default_memory_limit_mb}
                  defaultValue={settings.default_memory_limit_mb}
                  onBlur={e => updateSettingsMut.mutate({ default_memory_limit_mb: Number(e.target.value) })}
                  className="w-32 px-3 py-2 rounded-lg font-mono text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Язык по умолчанию' : 'Default language'}
                </label>
                <select
                  value={settings.default_language}
                  onChange={e => updateSettingsMut.mutate({ default_language: e.target.value })}
                  className="px-3 py-2 rounded-lg font-mono text-sm outline-none"
                  style={inputStyle}>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
