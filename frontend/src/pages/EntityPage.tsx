import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEntity, getEntityRelationships, createRelationship,
  deleteRelationship, getEntities, updateEntity, getRelationshipTypeSchemas,
} from '../api';
import {
  PERSON_RELATIONSHIP_TYPES, GENERIC_RELATIONSHIP_TYPES, BUILTIN_FIELD_PRESETS,
} from '../utils';
import { useLang } from '../i18n/LangProvider';
import { useSettings } from '../context/SettingsContext';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import MetadataEditor from '../components/ui/MetadataEditor';
import MiniGraph from '../components/graph/MiniGraph';
import DatePicker from '../components/ui/DatePicker';
import { ArrowLeft, Plus, Trash2, X, Camera, User, Edit2, Check, LayoutDashboard, FileText, Paperclip, Download, ExternalLink, Search } from 'lucide-react';
import { getAttachments, uploadAttachment, deleteAttachment, type AttachmentOut } from '../api';

export default function EntityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const { formatDate, dateLocale } = useSettings();
  const { getColor, schemas } = useEntitySchemas();
  const [addRelOpen, setAddRelOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const [editingPerson, setEditingPerson] = useState(false);
  const [personEdits, setPersonEdits] = useState<Record<string, string>>({});

  // Extra (non-structural) fields editing for person
  const [editingExtras, setEditingExtras] = useState(false);
  const [extrasEdits, setExtrasEdits] = useState<Record<string, string>>({});

  // Notes state
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesTab, setNotesTab] = useState<'write' | 'preview'>('write');

  const { data: entity } = useQuery({
    queryKey: ['entity', id],
    queryFn: () => getEntity(id!),
    enabled: !!id,
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ['entity-rels', id],
    queryFn: () => getEntityRelationships(id!),
    enabled: !!id,
  });

  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 500 }),
  });

  const addRelMutation = useMutation({
    mutationFn: createRelationship,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-rels', id] });
      setAddRelOpen(false);
    },
  });

  const deleteRelMutation = useMutation({
    mutationFn: deleteRelationship,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entity-rels', id] }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { value?: string; metadata?: Record<string, unknown> }) =>
      updateEntity(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity', id] });
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setEditingPerson(false);
      setEditingNotes(false);
    },
  });

  if (!entity) return (
    <div className="p-8 font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{t.loading}</div>
  );

  const isPerson = entity.type === 'person';
  const meta = (entity.metadata || {}) as Record<string, string>;
  const color = getColor(entity.type);
  const customSchema = schemas.find(s => s.name === entity.type);
  const builtinPreset = BUILTIN_FIELD_PRESETS[entity.type];

  const startEditPerson = () => {
    setPersonEdits({
      first_name: meta.first_name ?? '',
      last_name: meta.last_name ?? '',
      middle_name: meta.middle_name ?? '',
      dob: meta.dob ?? '',
    });
    setEditingPerson(true);
  };

  const savePersonEdits = () => {
    const newMeta = { ...meta, ...personEdits };
    const parts = [newMeta.last_name, newMeta.first_name, newMeta.middle_name].filter(Boolean);
    const newValue = parts.join(' ') || entity.value;
    updateMutation.mutate({ value: newValue, metadata: newMeta });
  };

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateMutation.mutate({ metadata: { ...meta, photo: e.target?.result as string } });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    const { photo: _, ...rest } = meta;
    updateMutation.mutate({ metadata: rest });
  };

  const startEditNotes = () => {
    setNotesText(entity.notes ?? '');
    setEditingNotes(true);
    setNotesTab('write');
  };

  const saveNotes = () => {
    updateMutation.mutate({ notes: notesText });
  };

  const displayName = isPerson
    ? [meta.last_name, meta.first_name, meta.middle_name].filter(Boolean).join(' ') || entity.value
    : entity.value;

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
  };

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-mono text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> {t.ep_back}
        </button>
        <Link
          to={`/entities/${id}/board`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
          style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
        >
          <LayoutDashboard size={12} /> {t.board_title}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">

          {/* PERSON CARD */}
          {isPerson ? (
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="p-6 flex items-start gap-5">
                <div className="relative flex-shrink-0 group">
                  <div
                    className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
                    style={{ background: 'var(--border)', border: '1px solid var(--border-light)' }}
                    onClick={() => photoRef.current?.click()}
                  >
                    {meta.photo
                      ? <img src={meta.photo} alt="" className="w-full h-full object-cover" />
                      : meta.custom_icon
                        ? <span className="text-3xl">{meta.custom_icon}</span>
                        : <User size={28} style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                  <div
                    className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={() => photoRef.current?.click()}
                  >
                    <Camera size={16} className="text-white" />
                  </div>
                  <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                    onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                  {meta.photo && (
                    <button
                      onClick={removePhoto}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff4444] border border-[#0a0c0f] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  )}
                  {/* Emoji icon for person (when no photo) */}
                  {!meta.photo && (
                    <div className="mt-1">
                      <EntityIconPicker
                        currentIcon={meta.custom_icon || ''}
                        defaultIcon={''}
                        onChange={icon => {
                          const newMeta = { ...meta };
                          if (icon) newMeta.custom_icon = icon; else delete newMeta.custom_icon;
                          updateMutation.mutate({ metadata: newMeta });
                        }}
                        lang={lang}
                      />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <EntityTypeBadge type="person" />
                  <h1 className="text-xl font-mono font-semibold mt-2" style={{ color }}>
                    {displayName}
                  </h1>
                  {meta.dob && <div className="text-sm font-mono mt-1" style={{ color: 'var(--text-muted)' }}>🎂 {meta.dob}</div>}
                  <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.ep_added} {formatDate(entity.created_at)}</div>
                </div>

                <button
                  onClick={editingPerson ? () => setEditingPerson(false) : startEditPerson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all"
                  style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                >
                  <Edit2 size={11} />
                  {editingPerson ? t.ep_meta_cancel : t.ep_meta_edit}
                </button>
              </div>

              <div className="border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                <div className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>{t.ep_person_info}</div>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: t.ep_person_last, key: 'last_name' },
                    { label: t.ep_person_first, key: 'first_name' },
                    { label: t.ep_person_middle, key: 'middle_name' },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <div className="text-[10px] font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                      {editingPerson ? (
                        <input
                          value={personEdits[key] ?? ''}
                          onChange={e => setPersonEdits(prev => ({ ...prev, [key]: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded font-mono text-sm outline-none"
                          style={inputStyle}
                        />
                      ) : (
                        <div className="text-sm font-mono" style={{ color: meta[key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {meta[key] || '—'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="w-48">
                  <div className="text-[10px] font-mono mb-1" style={{ color: 'var(--text-muted)' }}>{t.ep_person_dob}</div>
                  {editingPerson ? (
                    <DatePicker
                      value={personEdits.dob ?? ''}
                      onChange={v => setPersonEdits(prev => ({ ...prev, dob: v }))}
                      dateLocale={dateLocale}
                      lang={lang}
                    />
                  ) : (
                    <div className="text-sm font-mono" style={{ color: meta.dob ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {meta.dob || '—'}
                    </div>
                  )}
                </div>
                {editingPerson && (
                  <button
                    onClick={savePersonEdits}
                    disabled={updateMutation.isPending}
                    className="mt-4 flex items-center gap-2 px-4 py-2 font-mono text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    style={{ background: 'var(--accent)', color: '#0a0c0f' }}
                  >
                    <Check size={12} /> {t.ep_meta_save}
                  </button>
                )}
              </div>

              {/* Extra (schema + custom) fields — editable */}
              {(() => {
                const structural = new Set(['first_name', 'last_name', 'middle_name', 'dob', 'photo', 'notes', '_board_notes']);
                const extras = Object.entries(meta).filter(([k]) => !structural.has(k));
                // Also include schema-defined extra fields that may not have values yet
                const schemaExtras = (customSchema?.fields || []).filter(f => !structural.has(f.name));
                const allKeys = Array.from(new Set([...schemaExtras.map(f => f.name), ...extras.map(([k]) => k)]));
                if (!allKeys.length) return null;

                const startExtrasEdit = () => {
                  const init: Record<string, string> = {};
                  allKeys.forEach(k => { init[k] = meta[k] ?? ''; });
                  setExtrasEdits(init);
                  setEditingExtras(true);
                };
                const saveExtras = () => {
                  const newMeta = { ...meta };
                  allKeys.forEach(k => {
                    const v = extrasEdits[k];
                    if (v) newMeta[k] = v; else delete newMeta[k];
                  });
                  updateMutation.mutate({ metadata: newMeta });
                  setEditingExtras(false);
                };

                return (
                  <div className="border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.ep_custom_fields}</div>
                      {!editingExtras ? (
                        <button onClick={startExtrasEdit} className="flex items-center gap-1 text-xs font-mono transition-colors" style={{ color: 'var(--accent)' }}>
                          <Edit2 size={11} /> {lang === 'ru' ? 'Изменить' : 'Edit'}
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={saveExtras} disabled={updateMutation.isPending} className="flex items-center gap-1 px-2.5 py-1 font-mono text-xs font-semibold rounded disabled:opacity-50" style={{ background: 'var(--accent)', color: '#0a0c0f' }}>
                            <Check size={10} /> {lang === 'ru' ? 'Сохранить' : 'Save'}
                          </button>
                          <button onClick={() => setEditingExtras(false)} className="px-2.5 py-1 font-mono text-xs rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            {lang === 'ru' ? 'Отмена' : 'Cancel'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {allKeys.map(k => {
                        const schemaDef = schemaExtras.find(f => f.name === k);
                        const label = schemaDef ? ((lang === 'ru' && schemaDef.label_ru) ? schemaDef.label_ru : schemaDef.label_en) : k;
                        const ftype = schemaDef?.field_type || 'text';
                        return (
                          <div key={k} className={ftype === 'entities' ? 'col-span-2' : ''}>
                            <div className="text-[10px] font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
                            {editingExtras ? (
                              ftype === 'date' ? (
                                <DatePicker
                                  value={extrasEdits[k] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [k]: v }))}
                                  dateLocale={dateLocale}
                                  lang={lang}
                                />
                              ) : ftype === 'entity' ? (
                                <InlineEntityPicker
                                  value={extrasEdits[k] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [k]: v }))}
                                  entities={allEntities}
                                  schemas={schemas}
                                  lang={lang}
                                />
                              ) : ftype === 'entities' ? (
                                <InlineEntitiesPicker
                                  value={extrasEdits[k] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [k]: v }))}
                                  entities={allEntities}
                                  schemas={schemas}
                                  lang={lang}
                                />
                              ) : (
                                <input
                                  value={extrasEdits[k] ?? ''}
                                  onChange={e => setExtrasEdits(prev => ({ ...prev, [k]: e.target.value }))}
                                  className="w-full px-2 py-1 rounded font-mono text-xs outline-none border"
                                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                                />
                              )
                            ) : (
                              <EntityFieldDisplay
                                value={meta[k] ? String(meta[k]) : ''}
                                fieldType={ftype}
                                entities={allEntities}
                                schemas={schemas}
                                lang={lang}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* NON-PERSON CARD */
            <div className="rounded-xl p-6" style={cardStyle}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  {/* Avatar: photo or emoji icon */}
                  <div className="flex-shrink-0 space-y-1.5">
                    <div className="relative group" onClick={() => photoRef.current?.click()}>
                      <div
                        className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
                        style={{ background: `${color}18`, border: `1px solid ${color}40` }}
                      >
                        {meta.photo
                          ? <img src={meta.photo} alt="" className="w-full h-full object-cover" />
                          : <span className="text-2xl">{meta.custom_icon || customSchema?.icon || '🔍'}</span>
                        }
                      </div>
                      <div className="absolute inset-0 rounded-xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                        <Camera size={14} className="text-white" />
                      </div>
                      <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
                      {meta.photo && (
                        <button
                          onClick={e => { e.stopPropagation(); removePhoto(); }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff4444] border border-[#0a0c0f] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      )}
                    </div>
                    {/* Emoji icon quick-set */}
                    {!meta.photo && (
                      <EntityIconPicker
                        currentIcon={meta.custom_icon || ''}
                        defaultIcon={customSchema?.icon || '🔍'}
                        onChange={icon => {
                          const newMeta = { ...meta };
                          if (icon) newMeta.custom_icon = icon; else delete newMeta.custom_icon;
                          updateMutation.mutate({ metadata: newMeta });
                        }}
                        lang={lang}
                      />
                    )}
                  </div>
                  <div>
                    <EntityTypeBadge type={entity.type} />
                    <h1 className="text-xl font-mono font-semibold mt-2" style={{ color }}>{entity.value}</h1>
                    <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{entity.id}</p>
                  </div>
                </div>
              </div>
              <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.ep_added} {formatDate(entity.created_at)}</div>
            </div>
          )}

          {/* Metadata editor (non-person, with built-in presets and schema fields) */}
          {!isPerson && (() => {
            // Merge schema fields + builtin preset into one editable section
            const schemaFields = customSchema?.fields || [];
            const presetFields = builtinPreset || [];
            // Combined unique keys (schema takes priority for labels)
            const allStructured: { key: string; label: string; type: string }[] = [];
            const seen = new Set<string>();
            schemaFields.forEach(f => {
              if (!seen.has(f.name)) {
                seen.add(f.name);
                allStructured.push({ key: f.name, label: (lang === 'ru' && f.label_ru) ? f.label_ru : f.label_en, type: f.field_type });
              }
            });
            presetFields.forEach(f => {
              if (!seen.has(f.key)) {
                seen.add(f.key);
                allStructured.push({ key: f.key, label: lang === 'ru' ? f.label_ru : f.label_en, type: f.type });
              }
            });
            return (
              <div className="rounded-xl p-5" style={cardStyle}>
                {allStructured.length > 0 && (() => {
                  const startStructEdit = () => {
                    const init: Record<string, string> = {};
                    allStructured.forEach(f => { init[f.key] = meta[f.key] ?? ''; });
                    setExtrasEdits(prev => ({ ...prev, ...init }));
                    setEditingExtras(true);
                  };
                  const saveStructEdit = () => {
                    const newMeta = { ...meta };
                    allStructured.forEach(f => {
                      const v = extrasEdits[f.key];
                      if (v) newMeta[f.key] = v; else delete newMeta[f.key];
                    });
                    updateMutation.mutate({ metadata: newMeta });
                    setEditingExtras(false);
                  };
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Поля' : 'Structured fields'}
                        </div>
                        {!editingExtras ? (
                          <button onClick={startStructEdit} className="flex items-center gap-1 text-xs font-mono" style={{ color: 'var(--accent)' }}>
                            <Edit2 size={11} /> {lang === 'ru' ? 'Изменить' : 'Edit'}
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={saveStructEdit} disabled={updateMutation.isPending} className="flex items-center gap-1 px-2.5 py-1 font-mono text-xs font-semibold rounded disabled:opacity-50" style={{ background: 'var(--accent)', color: '#0a0c0f' }}>
                              <Check size={10} /> {lang === 'ru' ? 'Сохранить' : 'Save'}
                            </button>
                            <button onClick={() => setEditingExtras(false)} className="px-2.5 py-1 font-mono text-xs rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                              {lang === 'ru' ? 'Отмена' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {allStructured.map(field => (
                          <div key={field.key} className={field.type === 'entities' ? 'col-span-2' : ''}>
                            <div className="text-[10px] font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>{field.label}</div>
                            {editingExtras ? (
                              field.type === 'date' ? (
                                <DatePicker
                                  value={extrasEdits[field.key] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [field.key]: v }))}
                                  dateLocale={dateLocale}
                                  lang={lang}
                                />
                              ) : field.type === 'entity' ? (
                                <InlineEntityPicker
                                  value={extrasEdits[field.key] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [field.key]: v }))}
                                  entities={allEntities}
                                  schemas={schemas}
                                  lang={lang}
                                />
                              ) : field.type === 'entities' ? (
                                <InlineEntitiesPicker
                                  value={extrasEdits[field.key] ?? ''}
                                  onChange={v => setExtrasEdits(prev => ({ ...prev, [field.key]: v }))}
                                  entities={allEntities}
                                  schemas={schemas}
                                  lang={lang}
                                />
                              ) : (
                                <input
                                  type={field.type === 'number' ? 'number' : 'text'}
                                  value={extrasEdits[field.key] ?? ''}
                                  onChange={e => setExtrasEdits(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  className="w-full px-2 py-1 rounded font-mono text-xs outline-none border"
                                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                                />
                              )
                            ) : (
                              <EntityFieldDisplay
                                value={meta[field.key] || ''}
                                fieldType={field.type}
                                entities={allEntities}
                                schemas={schemas}
                                lang={lang}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 h-px" style={{ background: 'var(--border)' }} />
                    </div>
                  );
                })()}
                <MetadataEditor
                  value={(entity.metadata || {}) as Record<string, unknown>}
                  onChange={(newMeta) => updateMutation.mutate({ metadata: newMeta })}
                  editable
                />
              </div>
            );
          })()}

          {/* Notes section */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText size={13} style={{ color: 'var(--accent)' }} />
                <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.notes_title}</h2>
              </div>
              {!editingNotes ? (
                <button
                  onClick={startEditNotes}
                  className="flex items-center gap-1 text-xs font-mono transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <Edit2 size={11} /> {t.notes_edit}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Tabs */}
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-light)' }}>
                    {(['write', 'preview'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setNotesTab(tab)}
                        className="px-2.5 py-1 text-[10px] font-mono transition-colors"
                        style={notesTab === tab
                          ? { background: 'var(--accent)', color: '#0a0c0f' }
                          : { color: 'var(--text-muted)' }}
                      >
                        {tab === 'write' ? t.notes_write : t.notes_preview}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={saveNotes}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#0a0c0f' }}
                  >
                    <Check size={11} /> {t.notes_save}
                  </button>
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-xs transition-colors"
                    style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
                  >
                    <X size={11} /> {t.notes_cancel}
                  </button>
                </div>
              )}
            </div>

            {editingNotes ? (
              notesTab === 'write' ? (
                <textarea
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  placeholder={t.notes_placeholder}
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none resize-y"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                    color: 'var(--text-primary)',
                  }}
                />
              ) : (
                <div className="min-h-[100px] p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  {notesText
                    ? <MarkdownRenderer content={notesText} />
                    : <span className="text-xs font-mono italic" style={{ color: 'var(--text-muted)' }}>{t.notes_empty}</span>
                  }
                </div>
              )
            ) : (
              entity.notes ? (
                <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <MarkdownRenderer content={entity.notes} />
                </div>
              ) : (
                <p className="text-xs font-mono italic" style={{ color: 'var(--text-muted)' }}>{t.notes_empty}</p>
              )
            )}
          </div>

          {/* Relationships */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {t.ep_relationships} ({relationships.length})
              </h2>
              <button
                onClick={() => setAddRelOpen(true)}
                className="flex items-center gap-1 text-xs font-mono transition-colors"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={12} /> {t.ep_rel_add}
              </button>
            </div>
            <div className="space-y-1">
              {relationships.map(rel => {
                const other = rel.source_entity_id === id ? rel.target_entity : rel.source_entity;
                const direction = rel.source_entity_id === id ? '→' : '←';
                if (!other) return null;
                const otherMeta = (other.metadata || {}) as Record<string, string>;
                const otherName = other.type === 'person'
                  ? [otherMeta.last_name, otherMeta.first_name].filter(Boolean).join(' ') || other.value
                  : other.value;
                // Find friendly rel label
                const relTypes = [...PERSON_RELATIONSHIP_TYPES, ...GENERIC_RELATIONSHIP_TYPES];
                const relDef = relTypes.find(rt => rt.value === rel.type);
                const relLabel = relDef
                  ? `${relDef.emoji} ${lang === 'ru' ? relDef.label_ru : relDef.label_en}`
                  : rel.type;
                return (
                  <div key={rel.id} className="flex items-center gap-3 py-2.5 border-b last:border-0 group" style={{ borderColor: 'var(--border)' }}>
                    <span className="font-mono text-sm w-4" style={{ color: 'var(--text-muted)' }}>{direction}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>{relLabel}</span>
                    {other.type === 'person' && otherMeta.photo && (
                      <img src={otherMeta.photo} alt="" className="w-6 h-6 rounded-full object-cover border" style={{ borderColor: 'var(--border-light)' }} />
                    )}
                    <Link to={`/entities/${other.id}`} className="flex-1 flex items-center gap-2 hover:opacity-80">
                      <EntityTypeBadge type={other.type} size="sm" />
                      <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{otherName}</span>
                    </Link>
                    <button
                      onClick={() => deleteRelMutation.mutate(rel.id)}
                      className="opacity-0 group-hover:opacity-100 transition-all p-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
              {relationships.length === 0 && (
                <p className="text-xs font-mono py-2" style={{ color: 'var(--text-muted)' }}>{t.ep_rel_empty}</p>
              )}
            </div>
          </div>
        </div>

        {/* Attachments section */}
        <EntityAttachments entityId={id!} lang={lang} />

        {/* Right column */}
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.ep_graph_view}</span>
            </div>
            <div className="h-72">
              <MiniGraph entityId={id!} />
            </div>
            <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <Link to={`/graph?focus=${id}`} className="text-xs font-mono hover:underline" style={{ color: 'var(--accent)' }}>
                {t.ep_graph_open}
              </Link>
            </div>
          </div>

          <div className="rounded-xl p-4" style={cardStyle}>
            <div className="text-[10px] font-mono mb-1 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.ep_id}</div>
            <div className="text-[11px] font-mono break-all" style={{ color: 'var(--text-muted)' }}>{entity.id}</div>
          </div>

          {/* Built-in preset fields for non-person */}
          {!isPerson && builtinPreset && (
            <div className="rounded-xl p-4" style={cardStyle}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Быстрые поля' : 'Quick Fields'}
              </div>
              <div className="space-y-2">
                {builtinPreset.slice(0, 5).map(field => (
                  <div key={field.key}>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {lang === 'ru' ? field.label_ru : field.label_en}
                    </div>
                    <div className="text-xs font-mono" style={{ color: meta[field.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {meta[field.key] || '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {addRelOpen && (
        <AddRelModal
          entityId={id!}
          entityType={entity.type}
          entities={allEntities.filter(e => e.id !== id)}
          onSubmit={(data) => addRelMutation.mutate(data)}
          onClose={() => setAddRelOpen(false)}
          t={t}
          lang={lang}
        />
      )}
    </div>
  );
}

function AddRelModal({ entityId, entityType, entities, onSubmit, onClose, t, lang }: {
  entityId: string;
  entityType: string;
  entities: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
  t: any;
  lang: string;
}) {
  const [targetId, setTargetId] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetDropOpen, setTargetDropOpen] = useState(false);
  const [type, setType] = useState('');
  const [relTypeSearch, setRelTypeSearch] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');

  // Load custom relationship types
  const { data: customRelTypes = [] } = useQuery({
    queryKey: ['relationship-type-schemas'],
    queryFn: getRelationshipTypeSchemas,
  });

  // Build unified rel types list from custom types (seeded from builtins too)
  const relTypes = customRelTypes.map((rt: any) => ({
    value: rt.name,
    label_en: rt.label_en,
    label_ru: rt.label_ru || rt.label_en,
    emoji: rt.emoji || '🔗',
    color: rt.color,
  }));

  const filteredRelTypes = relTypeSearch.trim()
    ? relTypes.filter((rt: any) => {
        const q = relTypeSearch.toLowerCase();
        return rt.value.includes(q) || rt.label_en.toLowerCase().includes(q) || rt.label_ru?.toLowerCase().includes(q);
      })
    : relTypes;

  const handleSubmit = () => {
    if (!targetId || !type) return;
    onSubmit({
      source_entity_id: direction === 'out' ? entityId : targetId,
      target_entity_id: direction === 'out' ? targetId : entityId,
      type,
    });
  };

  const getEntityLabel = (e: any) => {
    const eMeta = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person'
      ? [eMeta.last_name, eMeta.first_name].filter(Boolean).join(' ') || e.value
      : e.value;
  };

  const filteredEntities = entities.filter(e => {
    if (!targetSearch.trim()) return true;
    const q = targetSearch.toLowerCase();
    return getEntityLabel(e).toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  }).slice(0, 30);

  const selectedEntity = targetId ? entities.find(e => e.id === targetId) : null;

  const modalStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
  };

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.rel_title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-4">
          {/* Direction */}
          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.rel_direction}</label>
            <div className="flex gap-2">
              {(['out', 'in'] as const).map(d => (
                <button key={d} onClick={() => setDirection(d)}
                  className="flex-1 py-2 rounded font-mono text-xs border transition-colors"
                  style={direction === d
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' }
                    : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                >
                  {d === 'out' ? t.rel_dir_out : t.rel_dir_in}
                </button>
              ))}
            </div>
          </div>

          {/* Relationship type with search */}
          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.rel_type}</label>
            <input
              value={relTypeSearch}
              onChange={e => setRelTypeSearch(e.target.value)}
              placeholder={lang === 'ru' ? '🔍 Поиск типа...' : '🔍 Search type...'}
              className="w-full px-3 py-2 rounded-lg font-mono text-xs outline-none mb-2"
              style={inputStyle}
            />
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {filteredRelTypes.map((rt: any) => (
                <button
                  key={rt.value}
                  onClick={() => setType(rt.value)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-mono border transition-all text-left"
                  style={type === rt.value
                    ? { borderColor: rt.color || 'var(--accent)', color: rt.color || 'var(--accent)', background: `${rt.color || 'var(--accent)'}22` }
                    : { borderColor: 'var(--border-light)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
                >
                  <span>{rt.emoji}</span>
                  <span className="truncate">{lang === 'ru' ? rt.label_ru : rt.label_en}</span>
                </button>
              ))}
              {filteredRelTypes.length === 0 && (
                <p className="col-span-2 text-xs font-mono py-2" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Не найдено' : 'No types found'}
                </p>
              )}
            </div>
          </div>

          {/* Target entity with search */}
          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.rel_target}</label>
            <div className="relative">
              <div
                onClick={() => setTargetDropOpen(v => !v)}
                className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none cursor-pointer flex items-center justify-between"
                style={{ ...inputStyle, borderRadius: targetDropOpen ? '8px 8px 0 0' : '8px' }}
              >
                {selectedEntity ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>[{selectedEntity.type}]</span>
                    <span style={{ color: 'var(--text-primary)' }}>{getEntityLabel(selectedEntity)}</span>
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.rel_target_placeholder}</span>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>▼</span>
              </div>
              {targetDropOpen && (
                <div className="absolute z-10 w-full border rounded-b-lg shadow-xl overflow-hidden"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)', borderTop: 'none' }}>
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                    <input
                      autoFocus
                      value={targetSearch}
                      onChange={e => setTargetSearch(e.target.value)}
                      placeholder={lang === 'ru' ? '🔍 Поиск сущности...' : '🔍 Search entity...'}
                      className="w-full px-2 py-1.5 rounded font-mono text-xs outline-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredEntities.map(e => (
                      <button
                        key={e.id}
                        onClick={() => { setTargetId(e.id); setTargetDropOpen(false); setTargetSearch(''); }}
                        className="w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--bg-secondary)] flex items-center gap-2"
                        style={{ color: e.id === targetId ? 'var(--accent)' : 'var(--text-primary)' }}
                      >
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>[{e.type}]</span>
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
              )}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!targetId || !type}
            className="w-full py-2.5 font-mono text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ background: 'var(--accent)', color: '#0a0c0f' }}
          >
            {t.rel_submit}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entity Attachments ────────────────────────────────────────────────────────

function EntityAttachments({ entityId, lang }: { entityId: string; lang: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery<AttachmentOut[]>({
    queryKey: ['attachments', entityId],
    queryFn: () => getAttachments(entityId),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAttachment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', entityId] }),
  });

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const data_b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await uploadAttachment(entityId, {
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
        size_bytes: file.size,
        data_b64,
      });
      qc.invalidateQueries({ queryKey: ['attachments', entityId] });
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  };

  const isImage = (mime: string) => mime.startsWith('image/');

  return (
    <div className="rounded-xl p-5 mt-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip size={13} style={{ color: 'var(--accent)' }} />
          <h2 className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? `Вложения (${attachments.length})` : `Attachments (${attachments.length})`}
          </h2>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="flex items-center gap-1 text-xs font-mono transition-colors disabled:opacity-40"
          style={{ color: 'var(--accent)' }}>
          <Plus size={11} /> {lang === 'ru' ? 'Прикрепить файл' : 'Attach file'}
        </button>
        <input ref={fileRef} type="file" className="hidden"
          onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg group"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              {isImage(att.mimetype) ? (
                <img src={`data:${att.mimetype};base64,${att.data_b64}`} alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--border)' }}>
                  <Paperclip size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{att.filename}</div>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {formatSize(att.size_bytes)} · {att.mimetype}
                </div>
              </div>
              <a href={`data:${att.mimetype};base64,${att.data_b64}`} download={att.filename}
                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--text-muted)' }}>
                <Download size={13} />
              </a>
              <button onClick={() => deleteMut.mutate(att.id)}
                className="p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {attachments.length === 0 && !uploading && (
        <p className="text-xs font-mono italic" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Нет вложений' : 'No attachments'}
        </p>
      )}
      {uploading && <p className="text-xs font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>Uploading…</p>}
    </div>
  );
}

// ── Helper: display entity/entities field as chips ───────────────────────────

function EntityFieldDisplay({
  value, fieldType, entities, schemas, lang,
}: {
  value: string; fieldType: string;
  entities: any[]; schemas: any[]; lang: string;
}) {
  if (!value) return <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>—</span>;

  const getLabel = (e: any) => {
    const m = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person' ? [m.last_name, m.first_name].filter(Boolean).join(' ') || e.value : e.value;
  };
  const getTypeIcon = (type: string) => {
    const s = schemas.find((x: any) => x.name === type);
    return s?.icon || '🔍';
  };

  if (fieldType === 'entity') {
    const ent = entities.find(e => e.id === value);
    if (!ent) return <span className="text-xs font-mono text-red-400 truncate">{value}</span>;
    return (
      <a href={`/entities/${ent.id}`} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs transition-colors hover:opacity-80"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
        <span>{getTypeIcon(ent.type)}</span>
        <span>{getLabel(ent)}</span>
      </a>
    );
  }

  if (fieldType === 'entities') {
    const ids = value.split(',').filter(Boolean);
    if (!ids.length) return <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map(id => {
          const ent = entities.find(e => e.id === id);
          if (!ent) return <span key={id} className="text-xs font-mono text-red-400">{id.slice(0, 8)}…</span>;
          return (
            <a key={id} href={`/entities/${ent.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs transition-colors hover:opacity-80"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
              <span>{getTypeIcon(ent.type)}</span>
              <span>{getLabel(ent)}</span>
            </a>
          );
        })}
      </div>
    );
  }

  return <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{value}</span>;
}

// ── Inline entity picker for EntityPage edit mode ────────────────────────────

function InlineEntityPicker({ value, onChange, entities, schemas, lang }: {
  value: string; onChange: (v: string) => void;
  entities: any[]; schemas: any[]; lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const getLabel = (e: any) => {
    const m = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person' ? [m.last_name, m.first_name].filter(Boolean).join(' ') || e.value : e.value;
  };
  const getTypeLabel = (type: string) => {
    const s = schemas.find((x: any) => x.name === type);
    if (!s) return type;
    return lang === 'ru' && s.label_ru ? s.label_ru : s.label_en;
  };
  const getIcon = (type: string) => schemas.find((x: any) => x.name === type)?.icon || '🔍';

  const filtered = entities.filter(e => {
    if (!search.trim()) return true;
    return getLabel(e).toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase());
  }).slice(0, 20);

  const selected = value ? entities.find(e => e.id === value) : null;

  return (
    <div className="relative">
      <div onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between px-2 py-1.5 rounded font-mono text-xs cursor-pointer border"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}>
        {selected ? (
          <span className="flex items-center gap-1.5">
            <span>{getIcon(selected.type)}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>[{getTypeLabel(selected.type)}]</span>
            {getLabel(selected)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Выбрать...' : 'Select...'}</span>
        )}
        <Search size={11} style={{ color: 'var(--text-muted)' }} />
      </div>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg shadow-xl overflow-hidden"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <div className="p-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'}
              className="w-full px-2 py-1 rounded font-mono text-xs outline-none"
              style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {value && <button onClick={() => { onChange(''); setOpen(false); }} className="w-full px-3 py-1.5 text-left font-mono text-xs text-red-400 hover:bg-red-400/10">✕ {lang === 'ru' ? 'Сбросить' : 'Clear'}</button>}
            {filtered.map(e => (
              <button key={e.id} onClick={() => { onChange(e.id); setOpen(false); setSearch(''); }}
                className="w-full px-3 py-1.5 text-left font-mono text-xs flex items-center gap-2 hover:bg-[var(--border)]"
                style={{ color: e.id === value ? 'var(--accent)' : 'var(--text-primary)' }}>
                <span>{getIcon(e.type)}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>[{getTypeLabel(e.type)}]</span>
                {getLabel(e)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InlineEntitiesPicker({ value, onChange, entities, schemas, lang }: {
  value: string; onChange: (v: string) => void;
  entities: any[]; schemas: any[]; lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedIds = value ? value.split(',').filter(Boolean) : [];
  const getLabel = (e: any) => {
    const m = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person' ? [m.last_name, m.first_name].filter(Boolean).join(' ') || e.value : e.value;
  };
  const getIcon = (type: string) => schemas.find((x: any) => x.name === type)?.icon || '🔍';
  const getTypeLabel = (type: string) => {
    const s = schemas.find((x: any) => x.name === type);
    return s ? (lang === 'ru' && s.label_ru ? s.label_ru : s.label_en) : type;
  };

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id];
    onChange(next.join(','));
  };

  const filtered = entities.filter(e => {
    if (!search.trim()) return true;
    return getLabel(e).toLowerCase().includes(search.toLowerCase());
  }).slice(0, 30);

  return (
    <div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selectedIds.map(id => {
            const e = entities.find(x => x.id === id);
            if (!e) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs"
                style={{ background: 'var(--border)', color: 'var(--text-primary)' }}>
                <span>{getIcon(e.type)}</span>
                {getLabel(e)}
                <button onClick={() => toggle(id)} className="ml-0.5" style={{ color: 'var(--text-muted)' }}>×</button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded font-mono text-xs border"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
          <Search size={11} /> {lang === 'ru' ? 'Добавить сущность...' : 'Add entity...'}
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full min-w-[260px] rounded-lg shadow-xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
            <div className="p-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'}
                className="w-full px-2 py-1 rounded font-mono text-xs outline-none"
                style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="max-h-44 overflow-y-auto">
              {filtered.map(e => (
                <button key={e.id} onClick={() => { toggle(e.id); }}
                  className="w-full px-3 py-1.5 text-left font-mono text-xs flex items-center gap-2 hover:bg-[var(--border)]"
                  style={{ color: selectedIds.includes(e.id) ? 'var(--accent)' : 'var(--text-primary)' }}>
                  {selectedIds.includes(e.id) && <Check size={10} style={{ color: 'var(--accent)' }} />}
                  <span>{getIcon(e.type)}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>[{getTypeLabel(e.type)}]</span>
                  {getLabel(e)}
                </button>
              ))}
            </div>
            <div className="p-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setOpen(false)} className="w-full px-2 py-1 font-mono text-xs text-center rounded"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {lang === 'ru' ? 'Готово' : 'Done'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EntityIconPicker: emoji icon picker for per-entity custom icon ────────────

const COMMON_ICONS = [
  '👤','👥','🧑','👩','👨','🧑‍💼','👔','🕵️','🧑‍🎓','🧑‍⚕️',
  '📱','📞','☎️','💬','📲','✉️','📧','📨','💌','📩',
  '🌐','🔗','💻','🖥️','⌨️','🖱️','📡','📶','🛜','🔌',
  '🏢','🏗️','🏦','🏥','🏛️','🏠','🏡','🏘️','🏚️','🔑',
  '🚗','🚕','✈️','🚢','🚂','🚁','🛸','🛵','🏍️','🚐',
  '💰','💵','💳','₿','🪙','💎','📈','📊','🏦','💹',
  '🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷',
  '⭐','🔥','💥','⚡','🌊','🌪️','🎯','🏆','🎖️','🥇',
  '🔒','🔓','🛡️','⚔️','🗡️','🔫','💣','🧨','🪤','🔐',
  '📁','📂','📋','📌','📍','🗂️','🗃️','📦','🗄️','🗑️',
];

function EntityIconPicker({ currentIcon, defaultIcon, onChange, lang }: {
  currentIcon: string; defaultIcon: string;
  onChange: (icon: string) => void; lang: string;
}) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] transition-colors"
        style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
        title={lang === 'ru' ? 'Установить иконку' : 'Set icon'}
      >
        {currentIcon ? <span>{currentIcon}</span> : <span>🎨</span>}
        <span>{lang === 'ru' ? 'иконка' : 'icon'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 rounded-xl shadow-2xl p-3 w-72"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru' ? 'Выбрать иконку' : 'Choose icon'}
            </div>
            <div className="grid grid-cols-10 gap-1 mb-3">
              {COMMON_ICONS.map(icon => (
                <button key={icon} onClick={() => { onChange(icon); setOpen(false); }}
                  className="w-6 h-6 text-base rounded hover:bg-[var(--bg-secondary)] flex items-center justify-center transition-colors"
                  style={{ background: currentIcon === icon ? 'var(--accent-dim)' : 'transparent',
                           outline: currentIcon === icon ? '1px solid var(--accent)' : 'none' }}>
                  {icon}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-2">
              <input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder={lang === 'ru' ? 'Свой эмодзи...' : 'Custom emoji...'}
                className="flex-1 px-2 py-1 rounded font-mono text-xs outline-none border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-light)', color: 'var(--text-primary)' }}
                maxLength={4}
              />
              <button
                onClick={() => { if (customInput.trim()) { onChange(customInput.trim()); setOpen(false); setCustomInput(''); } }}
                className="px-2 py-1 rounded font-mono text-xs font-semibold"
                style={{ background: 'var(--accent)', color: '#000' }}
              >
                {lang === 'ru' ? 'Ок' : 'Set'}
              </button>
            </div>
            {(currentIcon || defaultIcon) && (
              <button
                onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-center font-mono text-[10px] py-1 rounded hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {lang === 'ru' ? '✕ Сбросить к иконке типа' : '✕ Reset to type icon'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
