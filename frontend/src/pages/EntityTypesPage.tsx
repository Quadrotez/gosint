import { useState, useRef } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { createEntitySchema, deleteEntitySchema, updateEntitySchema } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { useLang } from '../i18n/LangProvider';
import { BUILTIN_FIELD_PRESETS } from '../utils';
import type { FieldDefinition, EntityTypeSchemaCreate, EntityTypeSchemaUpdate, EntityTypeSchema } from '../types';
import { Plus, X, Trash2, Check, Edit2, Shapes } from 'lucide-react';
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

export default function EntityTypesPage() {
  const { t, lang } = useLang();
  const { schemas, getColor, getIcon, getLabel } = useEntitySchemas();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingSchema, setEditingSchema] = useState<EntityTypeSchema | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Shared form state (create + edit)
  const [name, setName] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelRu, setLabelRu] = useState('');
  const [icon, setIcon] = useState('◆');
  const [iconImage, setIconImage] = useState<string | null>(null);
  const [color, setColor] = useState(PALETTE[4]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const iconImageRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customSchemas = schemas.filter(s => !s.is_builtin);

  const createMutation = useMutation({
    mutationFn: createEntitySchema,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entity-schemas'] }); resetForm(); },
    onError: (err: any) => {
      if (err?.response?.status === 409) setErrors({ name: t.etm_error_exists });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntityTypeSchemaUpdate }) => updateEntitySchema(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entity-schemas'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntitySchema,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entity-schemas'] }),
  });

  const resetForm = () => {
    setShowForm(false); setEditingSchema(null);
    setName(''); setLabelEn(''); setLabelRu('');
    setIcon('◆'); setIconImage(null); setColor(PALETTE[4]);
    setFields([]); setErrors({});
  };

  const startEdit = (schema: EntityTypeSchema) => {
    setEditingSchema(schema);
    setLabelEn(schema.label_en);
    setLabelRu(schema.label_ru || '');
    setIcon(schema.icon || '◆');
    setIconImage((schema as any).icon_image || null);
    setColor(schema.color || PALETTE[4]);
    setShowForm(true);

    // If schema has saved fields, use those; if it's a builtin with no saved fields yet,
    // pre-populate from BUILTIN_FIELD_PRESETS so the user can edit/remove them
    if (schema.fields && schema.fields.length > 0) {
      setFields(schema.fields.map(f => ({
        name: f.name, label_en: f.label_en, label_ru: f.label_ru || '',
        field_type: f.field_type as any, required: f.required,
      })));
    } else if (schema.is_builtin && BUILTIN_FIELD_PRESETS[schema.name]) {
      const preset = BUILTIN_FIELD_PRESETS[schema.name];
      setFields(preset.map(p => ({
        name: p.key, label_en: p.label_en, label_ru: p.label_ru,
        field_type: p.type, required: false,
      })));
    } else {
      setFields([]);
    }
    setErrors({});
  };

  const validate = (isEdit: boolean) => {
    const e: Record<string, string> = {};
    if (!isEdit && !/^[a-z0-9_]+$/.test(name)) e.name = t.etm_error_name;
    if (!labelEn.trim()) e.labelEn = t.etm_error_label;
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
        data: {
          label_en: labelEn.trim(), label_ru: labelRu.trim() || undefined,
          icon: icon.trim() || '◆', color, fields: fieldsList,
          icon_image: iconImage || undefined,
        },
      });
    } else {
      createMutation.mutate({
        name: name.trim(), label_en: labelEn.trim(), label_ru: labelRu.trim() || undefined,
        icon: icon.trim() || '◆', color, fields: fieldsList,
        icon_image: iconImage || undefined,
      } as EntityTypeSchemaCreate);
    }
  };

  const addField = () => setFields(f => [...f, emptyField()]);
  const removeField = (i: number) => setFields(f => f.filter((_, idx) => idx !== i));
  const updateField = (i: number, key: keyof FieldRow, val: string | boolean) =>
    setFields(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row));

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
  const inputStyle = { background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-primary)' };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Shapes size={20} style={{ color: 'var(--accent)' }} /> {t.etm_title}
          </h1>
          <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.etm_subtitle}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 font-mono text-sm font-semibold rounded-lg transition-colors"
            style={{ background: 'var(--accent)', color: '#0a0c0f' }}
          >
            <Plus size={14} /> {t.etm_create}
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-6 mb-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editingSchema ? t.etm_edit_title : t.etm_form_title}
            </h2>
            <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5">
            {/* Name (only for create) */}
            {!editingSchema && (
              <div>
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.etm_name_label} *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder={t.etm_name_placeholder}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-sm placeholder-[#4a5568] outline-none"
                  style={{ ...inputStyle, borderColor: errors.name ? '#ff4444' : 'var(--border-light)' }}
                />
                {errors.name && <p className="text-[#ff4444] text-[10px] font-mono mt-1">{errors.name}</p>}
                <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.etm_name_hint}</p>
              </div>
            )}

            {/* Icon + Color */}
            <div className="flex gap-4">
              <div className="w-24">
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.etm_icon_label}</label>
                <input
                  value={icon} onChange={e => setIcon(e.target.value)} placeholder={t.etm_icon_ph}
                  className="w-full px-3 py-2.5 rounded-lg font-mono text-lg text-center outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.etm_color_label}</label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map(c => (
                    <button key={c} onClick={() => setColor(c)}
                      className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: color === c ? '#ffffff' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Icon image upload */}
            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Изображение типа (квадрат, необязательно)' : 'Type image (square, optional)'}
              </label>
              <div className="flex items-center gap-3">
                {iconImage ? (
                  <div className="relative">
                    <img src={iconImage} alt="" className="w-12 h-12 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
                    <button onClick={() => setIconImage(null)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#ff4444] flex items-center justify-center">
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                    {icon}
                  </div>
                )}
                <button onClick={() => iconImageRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                  {lang === 'ru' ? '📁 Загрузить' : '📁 Upload'}
                </button>
                <input ref={iconImageRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = ev => setIconImage(ev.target?.result as string);
                    reader.readAsDataURL(f);
                    e.target.value = '';
                  }} />
              </div>
            </div>

            {/* Label EN */}
            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.etm_label_en} *</label>
              <input value={labelEn} onChange={e => setLabelEn(e.target.value)} placeholder={t.etm_label_en_ph}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={{ ...inputStyle, borderColor: errors.labelEn ? '#ff4444' : 'var(--border-light)' }}
              />
              {errors.labelEn && <p className="text-[#ff4444] text-[10px] font-mono mt-1">{errors.labelEn}</p>}
            </div>

            {/* Label RU */}
            <div>
              <label className="text-xs font-mono mb-1.5 block" style={{ color: 'var(--text-muted)' }}>{t.etm_label_ru}</label>
              <input value={labelRu} onChange={e => setLabelRu(e.target.value)} placeholder={t.etm_label_ru_ph}
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Live preview */}
          {(name || labelEn || editingSchema) && (
            <div className="mb-5 flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.ce_preview}</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border"
                style={{ color, backgroundColor: `${color}18`, borderColor: `${color}40` }}>
                {icon} {labelEn || editingSchema?.label_en || name}
              </span>
            </div>
          )}

          {/* Custom fields */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.etm_fields_label}</span>
              <button onClick={addField} className="flex items-center gap-1 text-xs font-mono hover:underline" style={{ color: 'var(--accent)' }}>
                <Plus size={11} /> {t.etm_fields_add}
              </button>
            </div>
            {fields.length > 0 && (
              <div className="space-y-2">
                <div className="grid gap-2 text-[10px] font-mono uppercase tracking-widest mb-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 24px', color: 'var(--text-muted)' }}>
                  <span>{t.etm_field_name}</span><span>{t.etm_field_label_en}</span>
                  <span>{t.etm_field_label_ru}</span><span>{t.etm_field_type}</span>
                  <span>{t.etm_field_required}</span><span />
                </div>
                {fields.map((f, i) => (
                  <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '1fr 1fr 1fr 80px 60px 24px' }}>
                    <input value={f.name} onChange={e => updateField(i, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder={t.etm_field_name_ph} className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
                    <input value={f.label_en} onChange={e => updateField(i, 'label_en', e.target.value)}
                      placeholder={t.etm_field_label_en} className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
                    <input value={f.label_ru} onChange={e => updateField(i, 'label_ru', e.target.value)}
                      placeholder={t.etm_field_label_ru} className="px-2 py-1.5 rounded font-mono text-xs outline-none" style={inputStyle} />
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
                    <button onClick={() => removeField(i)} className="p-0.5 flex-shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }}>
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
              <Check size={13} /> {editingSchema ? t.etm_update : t.etm_submit}
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 font-mono text-sm rounded-lg transition-colors"
              style={{ border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
              {t.etm_cancel}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Custom types */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.etm_custom}</h2>
          {customSchemas.length === 0 ? (
            <div className="rounded-xl p-6 text-center" style={cardStyle}>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.etm_empty}</p>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.etm_empty_hint}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customSchemas.map(schema => {
                const col = schema.color || '#7a8ba8';
                const label = lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
                return (
                  <div key={schema.id} className="rounded-xl p-4 flex items-center gap-3 group" style={cardStyle}>
                    <span className="text-xl w-8 text-center">{schema.icon || '◆'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm" style={{ color: col }}>{label}</div>
                      <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {schema.name} · {schema.fields?.length ?? 0} {lang === 'ru' ? 'полей' : 'fields'}
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(schema)}
                      className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(schema.id)}
                      className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Built-in types — now editable/deletable just like custom */}
        <div>
          <h2 className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.etm_builtin}</h2>
          <div className="space-y-2">
            {schemas.filter(s => s.is_builtin).map(schema => {
              const col = schema.color || getColor(schema.name);
              const label = lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
              return (
                <div key={schema.id} className="rounded-xl p-4 flex items-center gap-3 group" style={cardStyle}>
                  {(schema as any).icon_image
                    ? <img src={(schema as any).icon_image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    : <span className="text-xl w-8 text-center">{schema.icon || '◆'}</span>}
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm" style={{ color: col }}>{label}</div>
                    <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {schema.name}
                      <span className="ml-1.5 px-1 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                        {lang === 'ru' ? 'встроенный' : 'built-in'}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => startEdit(schema)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                    style={{ color: 'var(--text-muted)' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(schema.id)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                    style={{ color: 'var(--text-muted)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        message={t.etm_delete_confirm}
        confirmLabel={t.etm_cancel === 'Cancel' ? 'Delete' : 'Удалить'}
        cancelLabel={t.etm_cancel}
        onConfirm={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
