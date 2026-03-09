import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRelationshipTypeSchemas, createRelationshipTypeSchema,
  updateRelationshipTypeSchema, deleteRelationshipTypeSchema,
} from '../api';
import { useLang } from '../i18n/LangProvider';
import type { FieldDefinition, RelationshipTypeSchema } from '../types';
import { Plus, X, Trash2, Check, Edit2, GitBranch } from 'lucide-react';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const FIELD_TYPES = ['text', 'date', 'url', 'number', 'entity', 'entities'] as const;
const PALETTE = [
  '#f43f5e','#ec4899','#a855f7','#6366f1','#3b82f6',
  '#06b6d4','#10b981','#84cc16','#eab308','#f97316',
  '#00d4ff','#00ff88','#ffd700','#ff6b35','#ff4444',
];

interface FieldRow {
  name: string; label_en: string; label_ru: string;
  field_type: 'text' | 'date' | 'url' | 'number' | 'entity'; required: boolean;
}
function emptyField(): FieldRow {
  return { name: '', label_en: '', label_ru: '', field_type: 'text', required: false };
}

export default function RelationshipTypesPage() {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();

  const { data: schemas = [] } = useQuery<RelationshipTypeSchema[]>({
    queryKey: ['relationship-type-schemas'],
    queryFn: getRelationshipTypeSchemas,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingSchema, setEditingSchema] = useState<RelationshipTypeSchema | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelRu, setLabelRu] = useState('');
  const [emoji, setEmoji] = useState('🔗');
  const [color, setColor] = useState(PALETTE[4]);
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createRelationshipTypeSchema,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['relationship-type-schemas'] }); resetForm(); },
    onError: (err: any) => {
      if (err?.response?.status === 409) setErrors({ name: lang === 'ru' ? 'Тип с таким именем уже существует' : 'Type with this name already exists' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateRelationshipTypeSchema(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['relationship-type-schemas'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRelationshipTypeSchema,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['relationship-type-schemas'] }),
  });

  const resetForm = () => {
    setShowForm(false); setEditingSchema(null);
    setName(''); setLabelEn(''); setLabelRu(''); setEmoji('🔗');
    setColor(PALETTE[4]); setDescription(''); setFields([]); setErrors({});
  };

  const startEdit = (schema: RelationshipTypeSchema) => {
    setEditingSchema(schema);
    setLabelEn(schema.label_en);
    setLabelRu(schema.label_ru || '');
    setEmoji(schema.emoji || '🔗');
    setColor(schema.color || PALETTE[4]);
    setDescription(schema.description || '');
    setFields((schema.fields || []).map(f => ({
      name: f.name, label_en: f.label_en, label_ru: f.label_ru || '',
      field_type: f.field_type as any, required: f.required,
    })));
    setShowForm(true);
    setErrors({});
  };

  const validate = (isEdit: boolean) => {
    const e: Record<string, string> = {};
    if (!isEdit && !/^[a-z0-9_]+$/.test(name)) e.name = lang === 'ru' ? 'Только строчные буквы, цифры и _' : 'Only lowercase letters, digits and _';
    if (!labelEn.trim()) e.labelEn = lang === 'ru' ? 'Требуется заголовок' : 'Label is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    const isEdit = !!editingSchema;
    if (!validate(isEdit)) return;
    const fieldsList = fields.filter(f => f.name.trim()).map(f => ({
      name: f.name.trim(), label_en: f.label_en.trim() || f.name,
      label_ru: f.label_ru.trim() || undefined,
      field_type: f.field_type, required: f.required,
    } as FieldDefinition));

    if (isEdit) {
      updateMutation.mutate({
        id: editingSchema!.id,
        data: { label_en: labelEn.trim(), label_ru: labelRu.trim() || undefined,
          emoji: emoji || '🔗', color, description: description.trim() || undefined, fields: fieldsList },
      });
    } else {
      createMutation.mutate({
        name: name.trim(), label_en: labelEn.trim(), label_ru: labelRu.trim() || undefined,
        emoji: emoji || '🔗', color, description: description.trim() || undefined, fields: fieldsList,
      });
    }
  };

  const addField = () => setFields(f => [...f, emptyField()]);
  const removeField = (i: number) => setFields(f => f.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: keyof FieldRow, val: string | boolean) =>
    setFields(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
  const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' };

  const customSchemas = schemas.filter(s => !s.is_builtin);
  const builtinSchemas = schemas.filter(s => s.is_builtin);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <GitBranch size={20} style={{ color: 'var(--accent)' }} />
            {lang === 'ru' ? 'Типы связей' : 'Relationship Types'}
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Управление типами связей между сущностями' : 'Manage relationship types between entities'}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm font-semibold rounded-lg transition-colors"
            style={{ background: 'var(--accent)', color: '#0a0c0f' }}>
            <Plus size={14} /> {lang === 'ru' ? 'Создать тип' : 'Create type'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl p-6 mb-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editingSchema ? (lang === 'ru' ? 'Редактировать тип' : 'Edit type') : (lang === 'ru' ? 'Новый тип связи' : 'New relationship type')}
            </h2>
            <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
            {!editingSchema && (
              <div>
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Системное имя' : 'System name'} *
                </label>
                <input value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. works_for"
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-sm placeholder-[#4a5568] outline-none"
                  style={{ ...inputStyle, borderColor: errors.name ? '#ff4444' : 'var(--border-light)' }} />
                {errors.name && <p className="text-[#ff4444] text-[10px] font-mono mt-1">{errors.name}</p>}
              </div>
            )}

            <div className="flex gap-4">
              <div className="w-20">
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Emoji</label>
                <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🔗"
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-lg text-center outline-none"
                  style={inputStyle} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'ru' ? 'Цвет' : 'Color'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? '#ffffff' : 'transparent' }} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Название (EN)' : 'Label (EN)'} *
              </label>
              <input value={labelEn} onChange={e => setLabelEn(e.target.value)} placeholder="Works for"
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={{ ...inputStyle, borderColor: errors.labelEn ? '#ff4444' : 'var(--border-light)' }} />
              {errors.labelEn && <p className="text-[#ff4444] text-[10px] font-mono mt-1">{errors.labelEn}</p>}
            </div>

            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Название (RU)' : 'Label (RU)'}
              </label>
              <input value={labelRu} onChange={e => setLabelRu(e.target.value)} placeholder="Работает в"
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={inputStyle} />
            </div>

            <div className="col-span-2">
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Описание' : 'Description'}
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder={lang === 'ru' ? 'Необязательное описание типа связи' : 'Optional description'}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={inputStyle} />
            </div>
          </div>

          {/* Preview */}
          {(name || labelEn || editingSchema) && (
            <div className="mb-5 flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Preview:</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border"
                style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}>
                {emoji || '🔗'} {labelEn || editingSchema?.label_en || name}
              </span>
            </div>
          )}

          {/* Fields */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Поля' : 'Fields'}
              </span>
              <button onClick={addField} className="flex items-center gap-1 text-xs font-mono hover:underline" style={{ color: 'var(--accent)' }}>
                <Plus size={11} /> {lang === 'ru' ? 'Добавить поле' : 'Add field'}
              </button>
            </div>
            {fields.length > 0 && (
              <div className="space-y-2">
                <div className="grid gap-2 text-[10px] font-mono uppercase tracking-widest mb-1"
                  style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 24px', color: 'var(--text-muted)' }}>
                  <span>{lang === 'ru' ? 'Имя' : 'Name'}</span><span>Label EN</span>
                  <span>Label RU</span><span>{lang === 'ru' ? 'Тип' : 'Type'}</span>
                  <span>{lang === 'ru' ? 'Обяз.' : 'Req.'}</span><span />
                </div>
                {fields.map((f, i) => (
                  <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 24px' }}>
                    <input value={f.name} onChange={e => updateField(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="field_name" className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
                    <input value={f.label_en} onChange={e => updateField(i, 'label_en', e.target.value)}
                      placeholder="Label" className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
                    <input value={f.label_ru} onChange={e => updateField(i, 'label_ru', e.target.value)}
                      placeholder="Метка" className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
                    <select value={f.field_type} onChange={e => updateField(i, 'field_type', e.target.value)}
                      className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle}>
                      {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                    </select>
                    <div className="flex items-center justify-center">
                      <button onClick={() => updateField(i, 'required', !f.required)}
                        className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                        style={{ borderColor: f.required ? 'var(--accent)' : 'var(--border-light)', background: f.required ? 'var(--accent-dim)' : '' }}>
                        {f.required && <Check size={10} style={{ color: 'var(--accent)' }} />}
                      </button>
                    </div>
                    <button onClick={() => removeField(i)} className="p-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 font-mono text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: 'var(--accent)', color: '#0a0c0f' }}>
              <Check size={13} /> {editingSchema ? (lang === 'ru' ? 'Обновить' : 'Update') : (lang === 'ru' ? 'Создать' : 'Create')}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 font-mono text-sm rounded-lg transition-colors"
              style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
              {lang === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Custom types */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Пользовательские' : 'Custom'}
          </h2>
          {customSchemas.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={cardStyle}>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Нет пользовательских типов' : 'No custom types'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {customSchemas.map(schema => {
                const col = schema.color || '#7a8ba8';
                const label = lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
                return (
                  <div key={schema.id} className="rounded-xl p-4 flex items-center gap-3 group" style={cardStyle}>
                    <span className="text-xl w-8 text-center">{schema.emoji || '🔗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm" style={{ color: col }}>{label}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {schema.name} · {schema.fields?.length ?? 0} {lang === 'ru' ? 'полей' : 'fields'}
                      </div>
                      {schema.description && (
                        <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{schema.description}</div>
                      )}
                    </div>
                    <button onClick={() => startEdit(schema)} className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded" style={{ color: 'var(--text-muted)' }}><Edit2 size={13} /></button>
                    <button onClick={() => setConfirmDeleteId(schema.id)} className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Builtin types */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Встроенные' : 'Built-in'}
          </h2>
          <div className="space-y-2">
            {builtinSchemas.map(schema => {
              const col = schema.color || '#7a8ba8';
              const label = lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
              return (
                <div key={schema.id} className="rounded-xl p-4 flex items-center gap-3 group" style={cardStyle}>
                  <span className="text-xl w-8 text-center">{schema.emoji || '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm" style={{ color: col }}>{label}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {schema.name}
                      <span className="ml-1.5 px-1 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                        {lang === 'ru' ? 'встроенный' : 'built-in'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => startEdit(schema)} className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded" style={{ color: 'var(--text-muted)' }}><Edit2 size={13} /></button>
                  <button onClick={() => setConfirmDeleteId(schema.id)} className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded" style={{ color: 'var(--text-muted)' }}><Trash2 size={13} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message={lang === 'ru' ? 'Удалить этот тип связи?' : 'Delete this relationship type?'}
        confirmLabel={lang === 'ru' ? 'Удалить' : 'Delete'}
        cancelLabel={lang === 'ru' ? 'Отмена' : 'Cancel'}
        onConfirm={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
