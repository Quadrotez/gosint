import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getEntityGroups, createEntityGroup, updateEntityGroup,
  deleteEntityGroup, publishEntityGroup, unpublishEntityGroup,
  getEntities,
} from '../api';
import { useLang } from '../i18n/LangProvider';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { Plus, Edit2, Trash2, Globe, Lock, X, Check, Search, Users } from 'lucide-react';
import type { EntityGroup, Entity } from '../types';

export default function EntityGroupsPage() {
  const { lang } = useLang();
  const { schemas } = useEntitySchemas();
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EntityGroup | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState('');

  const { data: groups = [] } = useQuery({ queryKey: ['entity-groups'], queryFn: getEntityGroups });
  const { data: allEntities = [] } = useQuery({ queryKey: ['entities'], queryFn: () => getEntities({ limit: 1000 }) });

  const createMut = useMutation({
    mutationFn: createEntityGroup,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entity-groups'] }); resetForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateEntityGroup(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entity-groups'] }); resetForm(); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteEntityGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entity-groups'] }),
  });
  const publishMut = useMutation({
    mutationFn: publishEntityGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entity-groups'] }),
  });
  const unpublishMut = useMutation({
    mutationFn: unpublishEntityGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entity-groups'] }),
  });

  const resetForm = () => {
    setShowForm(false); setEditingGroup(null);
    setName(''); setDescription(''); setSelectedIds([]); setEntitySearch('');
  };

  const startEdit = (g: EntityGroup) => {
    setEditingGroup(g);
    setName(g.name);
    setDescription(g.description || '');
    setSelectedIds([...g.entity_ids]);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (editingGroup) {
      updateMut.mutate({ id: editingGroup.id, data: { name: name.trim(), description: description.trim() || undefined, entity_ids: selectedIds } });
    } else {
      createMut.mutate({ name: name.trim(), description: description.trim() || undefined, entity_ids: selectedIds });
    }
  };

  const getEntityLabel = (e: Entity) => {
    const m = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person' ? [m.last_name, m.first_name].filter(Boolean).join(' ') || e.value : e.value;
  };
  const getIcon = (type: string) => schemas.find(s => s.name === type)?.icon || '🔍';

  const filteredEntities = allEntities.filter(e => {
    if (!entitySearch.trim()) return true;
    return getEntityLabel(e).toLowerCase().includes(entitySearch.toLowerCase()) || e.type.toLowerCase().includes(entitySearch.toLowerCase());
  }).slice(0, 30);

  const toggleEntity = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
  const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            {lang === 'ru' ? 'Группы сущностей' : 'Entity Groups'}
          </h1>
          <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Создавайте группы сущностей и делитесь ими в Открытом поиске' : 'Create entity groups and share them in Open Search'}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold"
          style={{ background: 'var(--accent)', color: '#0a0c0f' }}
        >
          <Plus size={14} /> {lang === 'ru' ? 'Создать группу' : 'New Group'}
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-xl p-6 mb-6" style={cardStyle}>
          <h2 className="text-sm font-mono font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingGroup ? (lang === 'ru' ? 'Редактировать группу' : 'Edit Group') : (lang === 'ru' ? 'Новая группа' : 'New Group')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Название' : 'Name'} <span className="text-red-400">*</span>
              </label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={lang === 'ru' ? 'Название группы...' : 'Group name...'}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={inputStyle} />
            </div>
            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Описание' : 'Description'}
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder={lang === 'ru' ? 'Необязательное описание...' : 'Optional description...'}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={inputStyle} />
            </div>

            {/* Entity selection */}
            <div>
              <label className="text-xs font-mono mb-2 block uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Сущности' : 'Entities'} ({selectedIds.length})
              </label>

              {/* Selected entities */}
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedIds.map(id => {
                    const e = allEntities.find(x => x.id === id);
                    if (!e) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded font-mono text-xs"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                        <span>{getIcon(e.type)}</span>
                        {getEntityLabel(e)}
                        <button onClick={() => toggleEntity(id)} className="ml-1 hover:text-red-400">×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Search + add entities */}
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-light)' }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <Search size={12} style={{ color: 'var(--text-muted)' }} />
                  <input value={entitySearch} onChange={e => setEntitySearch(e.target.value)}
                    placeholder={lang === 'ru' ? 'Поиск сущностей...' : 'Search entities...'}
                    className="flex-1 bg-transparent font-mono text-xs outline-none"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                <div className="max-h-48 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
                  {filteredEntities.map(e => (
                    <button key={e.id} onClick={() => toggleEntity(e.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-[var(--border)]"
                      style={{ color: selectedIds.includes(e.id) ? 'var(--accent)' : 'var(--text-primary)' }}>
                      {selectedIds.includes(e.id) && <Check size={10} style={{ color: 'var(--accent)' }} />}
                      <span>{getIcon(e.type)}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{e.type}</span>
                      {getEntityLabel(e)}
                    </button>
                  ))}
                  {filteredEntities.length === 0 && (
                    <p className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      {lang === 'ru' ? 'Не найдено' : 'No results'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleSubmit} disabled={!name.trim() || createMut.isPending || updateMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#0a0c0f' }}>
                <Check size={12} /> {lang === 'ru' ? 'Сохранить' : 'Save'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 rounded-lg font-mono text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups list */}
      {groups.length === 0 && !showForm ? (
        <div className="rounded-xl p-12 text-center" style={cardStyle}>
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет групп. Создайте первую.' : 'No groups yet. Create your first one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const entityList = g.entity_ids.map(id => allEntities.find(e => e.id === id)).filter(Boolean) as Entity[];
            return (
              <div key={g.id} className="rounded-xl p-5" style={cardStyle}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                      {g.is_imported ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)40' }}>
                          ↓ {lang === 'ru' ? 'импортирована' : 'imported'}
                        </span>
                      ) : g.is_published ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)40' }}>
                          <Globe size={9} /> {lang === 'ru' ? 'опубликована' : 'published'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
                          style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                          <Lock size={9} /> {lang === 'ru' ? 'приватная' : 'private'}
                        </span>
                      )}
                    </div>
                    {g.description && (
                      <p className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>{g.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {entityList.length === 0 && (
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Нет сущностей' : 'No entities'}
                        </span>
                      )}
                      {entityList.slice(0, 8).map(e => (
                        <Link key={e.id} to={`/entities/${e.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs hover:opacity-80 transition-opacity"
                          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                          <span>{getIcon(e.type)}</span>
                          {getEntityLabel(e)}
                        </Link>
                      ))}
                      {entityList.length > 8 && (
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>+{entityList.length - 8}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!g.is_imported && (g.is_published ? (
                      <button onClick={() => unpublishMut.mutate(g.id)}
                        title={lang === 'ru' ? 'Снять с публикации' : 'Unpublish'}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded font-mono text-xs border transition-colors hover:border-red-400/60"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <Lock size={11} /> {lang === 'ru' ? 'Скрыть' : 'Unpublish'}
                      </button>
                    ) : (
                      <button onClick={() => publishMut.mutate(g.id)}
                        title={lang === 'ru' ? 'Опубликовать в Открытый поиск' : 'Publish to Open Search'}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded font-mono text-xs border transition-colors"
                        style={{ borderColor: 'var(--accent)40', color: 'var(--accent)', background: 'var(--accent-dim)' }}>
                        <Globe size={11} /> {lang === 'ru' ? 'Опубликовать' : 'Publish'}
                      </button>
                    ))}
                    <button onClick={() => startEdit(g)} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-muted)' }}>
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => setConfirmDeleteId(g.id)} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-muted)' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete */}
      {confirmDeleteId && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setConfirmDeleteId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-xl p-6 w-80" style={cardStyle}>
            <p className="font-mono text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
              {lang === 'ru' ? 'Удалить группу?' : 'Delete this group?'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { deleteMut.mutate(confirmDeleteId); setConfirmDeleteId(null); }}
                className="flex-1 py-2 rounded font-mono text-xs font-semibold" style={{ background: '#ff4444', color: '#fff' }}>
                {lang === 'ru' ? 'Удалить' : 'Delete'}
              </button>
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded font-mono text-xs border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Отмена' : 'Cancel'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
