import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEntity, getEntityRelationships, createRelationship,
  deleteRelationship, getEntities, updateEntity,
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
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import { ArrowLeft, Plus, Trash2, X, Camera, User, Edit2, Check, LayoutDashboard, FileText } from 'lucide-react';

export default function EntityPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const { formatDate } = useSettings();
  const { getColor, schemas } = useEntitySchemas();
  const [addRelOpen, setAddRelOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const [editingPerson, setEditingPerson] = useState(false);
  const [personEdits, setPersonEdits] = useState<Record<string, string>>({});

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
    enabled: addRelOpen,
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
    setNotesText(meta.notes ?? '');
    setEditingNotes(true);
    setNotesTab('write');
  };

  const saveNotes = () => {
    updateMutation.mutate({ metadata: { ...meta, notes: notesText } });
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
                    <input type="date" value={personEdits.dob ?? ''}
                      onChange={e => setPersonEdits(prev => ({ ...prev, dob: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded font-mono text-sm outline-none"
                      style={{ ...inputStyle, colorScheme: 'dark' }}
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

              {/* Extra fields */}
              {(() => {
                const structural = new Set(['first_name', 'last_name', 'middle_name', 'dob', 'photo', 'notes', '_board_notes']);
                const extras = Object.entries(meta).filter(([k]) => !structural.has(k));
                if (!extras.length) return null;
                return (
                  <div className="border-t px-6 py-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.ep_custom_fields}</div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      {extras.map(([k, v]) => (
                        <div key={k} className="flex gap-3">
                          <span className="text-xs font-mono w-28 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{k}</span>
                          <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* NON-PERSON CARD */
            <div className="rounded-xl p-6" style={cardStyle}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <EntityTypeBadge type={entity.type} />
                  <h1 className="text-xl font-mono font-semibold mt-2" style={{ color }}>{entity.value}</h1>
                  <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{entity.id}</p>
                </div>
              </div>
              <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.ep_added} {formatDate(entity.created_at)}</div>
            </div>
          )}

          {/* Metadata editor (non-person, with built-in presets) */}
          {!isPerson && (
            <div className="rounded-xl p-5" style={cardStyle}>
              {builtinPreset && (
                <div className="mb-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                    {lang === 'ru' ? 'Поля адреса' : 'Structured fields'}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {builtinPreset.map(field => (
                      <div key={field.key}>
                        <div className="text-[10px] font-mono mb-0.5" style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? field.label_ru : field.label_en}
                        </div>
                        <div className="text-xs font-mono" style={{ color: meta[field.key] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {meta[field.key] || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 h-px" style={{ background: 'var(--border)' }} />
                </div>
              )}
              <MetadataEditor
                value={(entity.metadata || {}) as Record<string, unknown>}
                onChange={(newMeta) => updateMutation.mutate({ metadata: newMeta })}
                editable
              />
            </div>
          )}

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
              meta.notes ? (
                <div className="p-3 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <MarkdownRenderer content={meta.notes} />
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
  const [type, setType] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');

  const isPerson = entityType === 'person';
  const relTypes = isPerson ? PERSON_RELATIONSHIP_TYPES : GENERIC_RELATIONSHIP_TYPES;

  const handleSubmit = () => {
    if (!targetId || !type) return;
    onSubmit({
      source_entity_id: direction === 'out' ? entityId : targetId,
      target_entity_id: direction === 'out' ? targetId : entityId,
      type,
    });
  };

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
        className="relative rounded-xl p-6 w-full max-w-md"
        style={modalStyle}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.rel_title}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <div className="space-y-4">
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

          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.rel_type}</label>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {relTypes.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setType(rt.value)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-mono border transition-all text-left"
                  style={type === rt.value
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' }
                    : { borderColor: 'var(--border-light)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}
                >
                  <span>{rt.emoji}</span>
                  <span className="truncate">{lang === 'ru' ? rt.label_ru : rt.label_en}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.rel_target}</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm outline-none"
              style={inputStyle}
            >
              <option value="">{t.rel_target_placeholder}</option>
              {entities.map(e => {
                const eMeta = (e.metadata || {}) as Record<string, string>;
                const label = e.type === 'person'
                  ? [eMeta.last_name, eMeta.first_name].filter(Boolean).join(' ') || e.value
                  : e.value;
                return <option key={e.id} value={e.id}>[{e.type}] {label}</option>;
              })}
            </select>
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
