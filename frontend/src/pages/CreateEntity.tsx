import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createEntity, getEntities, createRelationship } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { useLang } from '../i18n/LangProvider';
import { useSettings } from '../context/SettingsContext';
import { BUILTIN_ENTITY_TYPES, BUILTIN_FIELD_PRESETS } from '../utils';
import type { FieldDefinition, Entity } from '../types';
import { ArrowLeft, Plus, X, Camera, User, Search } from 'lucide-react';
import DatePicker from '../components/ui/DatePicker';

interface KVField { key: string; value: string; }


export default function CreateEntity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const { dateLocale } = useSettings();
  const { schemas, allTypeNames, getColor, getIcon, getLabel } = useEntitySchemas();
  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 1000 }),
    staleTime: 30_000,
  });
  const addressEntities = (allEntities as any[]).filter((e: any) => e.type === 'address');
  const [pendingGeoAddress, setPendingGeoAddress] = useState<{
    name: string; coords: string; existingId?: string; meta?: Record<string, string>;
  } | null>(null);

  const [type, setType] = useState('person');
  const [value, setValue] = useState('');

  // Person fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [personExtra, setPersonExtra] = useState<KVField[]>([]);
  const photoRef = useRef<HTMLInputElement>(null);

  // Non-person photo/icon
  const [entityPhoto, setEntityPhoto] = useState<string | null>(null);
  const [entityCustomIcon, setEntityCustomIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const entityPhotoRef = useRef<HTMLInputElement>(null);

  // Format date from YYYY-MM-DD to user's preferred locale for display
  const formatDob = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (dateLocale === 'mdy') return `${m}/${d}/${y}`;
    if (dateLocale === 'ymd') return `${y}-${m}-${d}`;
    return `${d}.${m}.${y}`;  // dmy default (Russia/Europe)
  };

  // Generic metadata fields
  const [metaFields, setMetaFields] = useState<KVField[]>([]);

  // Schema-defined field values
  const [schemaValues, setSchemaValues] = useState<Record<string, string>>({});

  const isPerson = type === 'person';
  const customSchema = schemas.find(s => s.name === type);
  const isBuiltin = BUILTIN_ENTITY_TYPES.includes(type);
  // Use schema.fields if available (for both custom and edited builtin types);
  // for unedited builtins fall back to BUILTIN_FIELD_PRESETS
  const schemaFields = customSchema?.fields && customSchema.fields.length > 0
    ? customSchema.fields
    : null;
  const presetFields = !schemaFields ? BUILTIN_FIELD_PRESETS[type] : null;

  const fullName = isPerson
    ? [lastName, firstName, middleName].filter(Boolean).join(' ')
    : '';

  const mutation = useMutation({
    mutationFn: createEntity,
    onSuccess: (entity) => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      // Auto-create relationships for entity/entities fields with is_relation=true
      const fields = customSchema?.fields || [];
      fields.forEach((f: any) => {
        if (!f.is_relation) return;
        const relType = f.relation_type || 'linked_to';
        const dir = f.relation_direction || 'this_to_other';
        const makeRel = (a: string, b: string) =>
          createRelationship({ source_entity_id: a, target_entity_id: b, type: relType });
        if (f.field_type === 'entity') {
          const targetId = schemaValues[f.name];
          if (targetId) {
            if (dir === 'bidirectional') {
              makeRel(entity.id, targetId);
              makeRel(targetId, entity.id);
            } else {
              const src = dir === 'other_to_this' ? targetId : entity.id;
              const tgt = dir === 'other_to_this' ? entity.id : targetId;
              makeRel(src, tgt);
            }
          }
        } else if (f.field_type === 'entities') {
          const ids = (schemaValues[f.name] || '').split(',').filter(Boolean);
          ids.forEach((tid: string) => {
            if (dir === 'bidirectional') {
              makeRel(entity.id, tid);
              makeRel(tid, entity.id);
            } else {
              const src = dir === 'other_to_this' ? tid : entity.id;
              const tgt = dir === 'other_to_this' ? entity.id : tid;
              makeRel(src, tgt);
            }
          });
        }
      });
      if (pendingGeoAddress) {
        const link = (addrId: string) => {
          createRelationship({ source_entity_id: entity.id, target_entity_id: addrId, type: 'located_at' });
          queryClient.invalidateQueries({ queryKey: ['entities'] });
        };
        if (pendingGeoAddress.existingId) {
          link(pendingGeoAddress.existingId);
        } else {
          createEntity({
            type: 'address',
            value: pendingGeoAddress.name,
            metadata: pendingGeoAddress.meta || { coordinates: pendingGeoAddress.coords },
          }).then(a => link(a.id)).catch(() => {});
        }
      }
      navigate(`/entities/${entity.id}`);
    },
  });

  const handlePhotoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleTypeChange = (t: string) => {
    setType(t);
    setValue('');
    setMetaFields([]);
    setSchemaValues({});
    setEntityPhoto(null);
    setEntityCustomIcon('');
    setShowIconPicker(false);
  };

  const handleSubmit = () => {
    let entityValue = '';
    let metadata: Record<string, unknown> | null = null;

    if (isPerson) {
      entityValue = fullName || firstName || lastName || (lang === 'ru' ? 'Неизвестная персона' : 'Unknown Person');
      const m: Record<string, unknown> = {};
      if (firstName) m.first_name = firstName;
      if (lastName) m.last_name = lastName;
      if (middleName) m.middle_name = middleName;
      if (dob) m.dob = dob;
      if (photo) m.photo = photo;
      // Save any extra schema fields defined for person type
      if (schemaFields) {
        schemaFields.filter(f => !['last_name','first_name','middle_name','dob','photo'].includes(f.name)).forEach(f => {
          const v = schemaValues[f.name];
          if (v) m[f.name] = v;
        });
      }
      personExtra.forEach(({ key, value: v }) => { if (key.trim()) m[key.trim()] = v; });
      metadata = Object.keys(m).length > 0 ? m : null;
    } else {
      const m: Record<string, unknown> = {};
      if (entityPhoto) m.photo = entityPhoto;
      if (entityCustomIcon) m.custom_icon = entityCustomIcon;
      if (schemaFields) {
        schemaFields.forEach(f => {
          if (f.field_type === 'entity') {
            const v = schemaValues[f.name];
            if (v) m[f.name] = v;
          } else {
            const v = schemaValues[f.name];
            if (v) m[f.name] = v;
          }
        });
      } else if (presetFields) {
        presetFields.forEach(f => {
          const v = schemaValues[f.key];
          if (v) m[f.key] = v;
        });
      }
      metaFields.forEach(({ key, value: v }) => { if (key.trim()) m[key.trim()] = v; });
      if (value.trim()) {
        entityValue = value.trim();
      } else {
        // Auto-compose value from schema/preset fields, fallback to type label
        if (type === 'address') {
          const parts = ['city', 'street', 'building', 'apartment'].map(k => m[k] as string).filter(Boolean);
          entityValue = parts.join(', ');
        }
        if (!entityValue && schemaFields) {
          for (const f of schemaFields) {
            const v = schemaValues[f.name];
            if (v && typeof v === 'string' && v.trim() &&
                f.field_type !== 'entity' && f.field_type !== 'entities' && f.field_type !== 'geoposition') {
              entityValue = v.trim();
              break;
            }
          }
        }
        if (!entityValue && presetFields) {
          for (const f of presetFields) {
            const v = schemaValues[f.key];
            if (v && typeof v === 'string' && v.trim()) { entityValue = v.trim(); break; }
          }
        }
        if (!entityValue) entityValue = getLabel(type) || type;
      }
      metadata = Object.keys(m).length > 0 ? m : null;
    }

    mutation.mutate({ type, value: entityValue, metadata });
  };

  const hasSchemaValues = schemaFields
    ? schemaFields.some(f => schemaValues[f.name]?.trim())
    : (presetFields ? presetFields.some(f => schemaValues[f.key]?.trim()) : false);
  const canSubmit = true;  // value is auto-composed if empty
  const color = getColor(type);
  const customTypes = schemas.filter(s => !s.is_builtin);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-muted)] mb-6 font-mono text-sm transition-colors"
      >
        <ArrowLeft size={14} /> {t.ep_back}
      </button>

      <h1 className="text-2xl font-mono font-semibold text-[var(--text-primary)] mb-1">{t.ce_title}</h1>
      <p className="text-sm text-[var(--text-muted)] font-mono mb-8">{t.ce_subtitle}</p>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 space-y-6">

        {/* Type selector */}
        <div>
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3 block">{t.ce_type_label}</label>

          {/* Built-in types */}
          <div className="grid grid-cols-5 gap-2 mb-2">
            {BUILTIN_ENTITY_TYPES.map(ttype => (
              <button
                key={ttype}
                onClick={() => handleTypeChange(ttype)}
                className="py-2 px-1 rounded-lg font-mono text-[10px] border transition-all flex flex-col items-center gap-1"
                style={type === ttype ? {
                  borderColor: getColor(ttype),
                  color: getColor(ttype),
                  backgroundColor: `${getColor(ttype)}15`,
                } : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
              >
                <span>{getIcon(ttype)}</span>
                <span className="truncate w-full text-center leading-tight">{getLabel(ttype)}</span>
              </button>
            ))}
          </div>

          {/* Custom types */}
          {customTypes.length > 0 && (
            <>
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest my-2">
                {lang === 'ru' ? 'Кастомные типы' : 'Custom types'}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {customTypes.map(schema => {
                  const col = schema.color || '#7a8ba8';
                  const label = lang === 'ru' ? (schema.label_ru || schema.label_en) : schema.label_en;
                  return (
                    <button
                      key={schema.name}
                      onClick={() => handleTypeChange(schema.name)}
                      className="py-2 px-1 rounded-lg font-mono text-[10px] border transition-all flex flex-col items-center gap-1"
                      style={type === schema.name ? {
                        borderColor: col,
                        color: col,
                        backgroundColor: `${col}15`,
                      } : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}
                    >
                      <span>{schema.icon || '◆'}</span>
                      <span className="truncate w-full text-center leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── PERSON FORM ── */}
        {isPerson && (
          <div className="space-y-5">
            <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 flex items-center gap-2">
              <User size={12} /> {t.ce_person_title}
            </div>
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              {lang === 'ru' ? 'Все поля необязательны' : 'All fields are optional'}
            </p>

            {/* Photo */}
            <div>
              <label className="text-xs font-mono text-[var(--text-muted)] mb-2 block">{t.ce_person_photo}</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => photoRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-light)] hover:border-[#00d4ff60] flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-[var(--bg-secondary)] relative group"
                >
                  {photo ? (
                    <>
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <Camera size={16} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera size={20} className="text-[var(--text-muted)] group-hover:text-[#00d4ff] transition-colors" />
                  )}
                </div>
                <div>
                  <button onClick={() => photoRef.current?.click()} className="text-xs font-mono text-[#00d4ff] hover:underline block mb-1">
                    {t.ce_person_photo_hint}
                  </button>
                  {photo && (
                    <button onClick={() => setPhoto(null)} className="text-xs font-mono text-[var(--text-muted)] hover:text-[#ff4444]">
                      {t.ep_person_photo_remove}
                    </button>
                  )}
                </div>
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} />
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t.ce_person_last, ph: t.ce_person_last_ph, val: lastName, set: setLastName },
                { label: t.ce_person_first, ph: t.ce_person_first_ph, val: firstName, set: setFirstName },
                { label: t.ce_person_middle, ph: t.ce_person_middle_ph, val: middleName, set: setMiddleName },
              ].map(({ label, ph, val, set }) => (
                <div key={label}>
                  <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">{label}</label>
                  <input
                    value={val}
                    onChange={e => set(e.target.value)}
                    placeholder={ph}
                    className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                  />
                </div>
              ))}
            </div>

            {/* DOB — custom locale-aware 3-part date input */}
            <div className="w-full max-w-xs">
              <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">{t.ce_person_dob}</label>
              <DatePicker value={dob} onChange={setDob} dateLocale={dateLocale} />
            </div>

            {/* Schema-defined extra fields for person (custom fields added in EntityTypesPage) */}
            {schemaFields && schemaFields.filter(f => !['last_name','first_name','middle_name','dob','photo'].includes(f.name)).length > 0 && (
              <div className="space-y-3">
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest block">
                  {lang === 'ru' ? 'Дополнительные поля' : 'Extra Fields'}
                </label>
                {schemaFields.filter(f => !['last_name','first_name','middle_name','dob','photo'].includes(f.name)).map((f: FieldDefinition) => {
                  const label = (lang === 'ru' && f.label_ru) ? f.label_ru : f.label_en;
                  if (f.field_type === 'entity') {
                    return (
                      <EntityFieldPicker
                        key={f.name} label={label} required={f.required}
                        value={schemaValues[f.name] || ''}
                        onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                        lang={lang}
                      />
                    );
                  }
                  if (f.field_type === 'entities') {
                    return (
                      <EntitiesFieldPicker
                        key={f.name} label={label} required={f.required}
                        value={schemaValues[f.name] || ''}
                        onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                        lang={lang}
                      />
                    );
                  }
                  if (f.field_type === 'geoposition') {
                    return (
                      <GeoPositionPicker
                        key={f.name} label={label} required={f.required}
                        value={schemaValues[f.name] || ''}
                        onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                        onAddressResolved={(name, coords, meta) => setPendingGeoAddress({ name, coords, meta })}
                        onExistingAddressPicked={(id) => { const e = addressEntities.find((a: any) => a.id === id); const coords = e ? ((e.metadata||{}) as any).coordinates || '' : ''; setPendingGeoAddress({ name: e?.value || '', coords, existingId: id }); }}
                        addressEntities={addressEntities}
                        lang={lang}
                      />
                    );
                  }
                  return (
                    <div key={f.name}>
                      <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
                        {label}{f.required && <span className="text-[#ff4444] ml-1">*</span>}
                      </label>
                      {f.field_type === 'date' ? (
                        <DatePicker value={schemaValues[f.name] || ''} onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))} dateLocale={dateLocale} />
                      ) : f.field_type === 'boolean' ? (
                        <button type="button"
                          onClick={() => setSchemaValues(prev => ({ ...prev, [f.name]: prev[f.name] === 'true' ? 'false' : 'true' }))}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm"
                          style={{ background: schemaValues[f.name] === 'true' ? '#1a3a2a' : '#2d1515', color: schemaValues[f.name] === 'true' ? '#4ade80' : '#f87171', border: '1px solid var(--border-light)' }}>
                          {schemaValues[f.name] === 'true' ? '✓ Да / Yes' : '✗ Нет / No'}
                        </button>
                      ) : f.field_type === 'select' ? (
                        <select value={schemaValues[f.name] || ''} onChange={e => setSchemaValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]">
                          <option value="">{lang === 'ru' ? '— выбрать —' : '— select —'}</option>
                          {(f.select_options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.field_type === 'number' ? 'number' : 'text'}
                          value={schemaValues[f.name] || ''}
                          onChange={e => setSchemaValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                          placeholder={f.name}
                          className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Extra fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-[var(--text-muted)]">{t.ce_person_custom}</label>
                <button
                  onClick={() => setPersonExtra(f => [...f, { key: '', value: '' }])}
                  className="text-xs font-mono text-[#00d4ff] hover:underline flex items-center gap-1"
                >
                  <Plus size={11} /> {t.ce_person_add_field}
                </button>
              </div>
              {personExtra.map((cf, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <input
                    value={cf.key}
                    onChange={e => setPersonExtra(f => f.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                    placeholder={t.ce_person_field_name}
                    className="w-36 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                  />
                  <input
                    value={cf.value}
                    onChange={e => setPersonExtra(f => f.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                    placeholder={t.ce_person_field_value}
                    className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                  />
                  <button onClick={() => setPersonExtra(f => f.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-[#ff4444] p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="rounded-lg p-3 font-mono text-xs border" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
              <span className="text-[var(--text-muted)]">{t.ce_preview} </span>
              <span style={{ color }}>{getLabel(type)}</span>
              {fullName ? (
                <span className="text-[var(--text-primary)] ml-2">{fullName}</span>
              ) : (
                <span className="text-[var(--text-muted)] ml-2 italic">{lang === 'ru' ? 'Неизвестная персона' : 'Unknown Person'}</span>
              )}
              {dob && <span className="text-[var(--text-muted)] ml-2">· {formatDob(dob)}</span>}
            </div>
          </div>
        )}

        {/* ── NON-PERSON FORM (unified for builtin + custom, with schema or preset fields) ── */}
        {!isPerson && (
          <div className="space-y-4">
            {/* Photo / icon block */}
            <div className="flex items-start gap-4 pb-2">
              {/* Photo upload */}
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
                  {lang === 'ru' ? 'Фото' : 'Photo'}
                </label>
                <div
                  className="relative w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center cursor-pointer group"
                  style={{ background: `${color}18`, border: `1px solid ${color}40` }}
                  onClick={() => entityPhotoRef.current?.click()}
                >
                  {entityPhoto ? (
                    <img src={entityPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{entityCustomIcon || schemas.find(s => s.name === type)?.icon || '🔍'}</span>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={14} className="text-white" />
                  </div>
                  <input
                    ref={entityPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setEntityPhoto(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                {entityPhoto && (
                  <button
                    onClick={() => setEntityPhoto(null)}
                    className="text-xs font-mono mt-1 hover:text-[#ff4444] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ✕ {lang === 'ru' ? 'Убрать' : 'Remove'}
                  </button>
                )}
              </div>

              {/* Custom emoji icon (when no photo) */}
              {!entityPhoto && (
                <div className="flex-1">
                  <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
                    {lang === 'ru' ? 'Иконка (эмодзи)' : 'Icon (emoji)'}
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['👤','🏢','📱','🌐','💻','🔑','📁','🚗','💰','🔒','⭐','🎯','📡','🕵️','🏦'].map(ico => (
                      <button
                        key={ico}
                        type="button"
                        onClick={() => setEntityCustomIcon(entityCustomIcon === ico ? '' : ico)}
                        className="w-8 h-8 rounded flex items-center justify-center text-base transition-all"
                        style={{
                          background: entityCustomIcon === ico ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                          border: `1px solid ${entityCustomIcon === ico ? 'var(--accent)' : 'var(--border-light)'}`,
                        }}
                      >
                        {ico}
                      </button>
                    ))}
                  </div>
                  <input
                    value={entityCustomIcon}
                    onChange={e => setEntityCustomIcon(e.target.value)}
                    placeholder={lang === 'ru' ? 'или введите свой эмодзи...' : 'or type custom emoji...'}
                    className="w-full px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                    maxLength={4}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2 block">
                {t.ce_value_label} <span className="text-[10px] normal-case font-normal" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>({lang === 'ru' ? 'необязательно' : 'optional'})</span>
              </label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={lang === 'ru' ? 'Оставьте пустым — заполнится автоматически' : 'Leave empty — auto-filled from fields'}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                style={{ borderColor: value ? `${color}60` : '' }}
              />
            </div>

            {/* Schema-defined fields (includes edited builtins) */}
            {schemaFields && schemaFields.length > 0 && (
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3 block">
                  {lang === 'ru' ? 'Поля' : 'Fields'}
                </label>
                <div className="space-y-3">
                  {schemaFields.map((f: FieldDefinition) => {
                    const label = (lang === 'ru' && f.label_ru) ? f.label_ru : f.label_en;
                    if (f.field_type === 'entity') {
                      return (
                        <EntityFieldPicker
                          key={f.name}
                          label={label}
                          required={f.required}
                          value={schemaValues[f.name] || ''}
                          onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                          lang={lang}
                        />
                      );
                    }
                    if (f.field_type === 'entities') {
                      return (
                        <EntitiesFieldPicker
                          key={f.name}
                          label={label}
                          required={f.required}
                          value={schemaValues[f.name] || ''}
                          onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                          lang={lang}
                        />
                      );
                    }
                    if (f.field_type === 'geoposition') {
                      return (
                        <GeoPositionPicker
                          key={f.name}
                          label={label}
                          required={f.required}
                          value={schemaValues[f.name] || ''}
                          onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))}
                          onAddressResolved={(name, coords, meta) => setPendingGeoAddress({ name, coords, meta })}
                          onExistingAddressPicked={(id) => { const e = addressEntities.find((a: any) => a.id === id); const coords = e ? ((e.metadata||{}) as any).coordinates || '' : ''; setPendingGeoAddress({ name: e?.value || '', coords, existingId: id }); }}
                          addressEntities={addressEntities}
                          lang={lang}
                        />
                      );
                    }
                    return (
                      <div key={f.name}>
                        <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
                          {label}{f.required && <span className="text-[#ff4444] ml-1">*</span>}
                        </label>
                        {f.field_type === 'date' ? (
                          <DatePicker value={schemaValues[f.name] || ''} onChange={v => setSchemaValues(prev => ({ ...prev, [f.name]: v }))} dateLocale={dateLocale} />
                        ) : f.field_type === 'boolean' ? (
                          <button type="button"
                            onClick={() => setSchemaValues(prev => ({ ...prev, [f.name]: prev[f.name] === 'true' ? 'false' : 'true' }))}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-sm"
                            style={{ background: schemaValues[f.name] === 'true' ? '#1a3a2a' : '#2d1515', color: schemaValues[f.name] === 'true' ? '#4ade80' : '#f87171', border: '1px solid var(--border-light)' }}>
                            {schemaValues[f.name] === 'true' ? '✓ Да / Yes' : '✗ Нет / No'}
                          </button>
                        ) : f.field_type === 'select' ? (
                          <select value={schemaValues[f.name] || ''} onChange={e => setSchemaValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                            className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-hover)]">
                            <option value="">{lang === 'ru' ? '— выбрать —' : '— select —'}</option>
                            {(f.select_options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type={f.field_type === 'number' ? 'number' : 'text'}
                            value={schemaValues[f.name] || ''}
                            onChange={e => setSchemaValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                            placeholder={f.name}
                            className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preset fields (unedited builtins) */}
            {presetFields && presetFields.length > 0 && (
              <div>
                <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest mb-3 block">
                  {lang === 'ru' ? 'Поля' : 'Fields'}
                </label>
                <div className="space-y-3">
                  {presetFields.map(f => {
                    const label = lang === 'ru' ? f.label_ru : f.label_en;
                    return (
                      <div key={f.key}>
                        <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">{label}</label>
                        {f.type === 'date' ? (
                          <DatePicker value={schemaValues[f.key] || ''} onChange={v => setSchemaValues(prev => ({ ...prev, [f.key]: v }))} dateLocale={dateLocale} />
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            value={schemaValues[f.key] || ''}
                            onChange={e => setSchemaValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={label}
                            className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <MetaFieldsEditor fields={metaFields} onChange={setMetaFields} lang={lang} />

            {value && (
              <div className="rounded-lg p-3 font-mono text-xs border" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <span className="text-[var(--text-muted)]">{t.ce_preview} </span>
                <span style={{ color }}>{getLabel(type)}</span>
                <span className="text-[var(--text-primary)] ml-2">{value}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          className="w-full py-3 bg-[var(--accent)] text-[#ffffff] font-mono text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending ? t.ce_submitting : t.ce_submit}
        </button>

        {mutation.isError && (
          <p className="text-[#ff4444] text-xs font-mono text-center">{t.ce_error}</p>
        )}
      </div>
    </div>
  );
}

function MetaFieldsEditor({
  fields, onChange, lang,
}: {
  fields: { key: string; value: string }[];
  onChange: (f: { key: string; value: string }[]) => void;
  lang: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">
          {lang === 'ru' ? 'Метаданные' : 'Metadata'}
        </label>
        <button
          onClick={() => onChange([...fields, { key: '', value: '' }])}
          className="text-xs font-mono text-[#00d4ff] hover:underline flex items-center gap-1"
        >
          <Plus size={11} /> {lang === 'ru' ? '+ Добавить поле' : '+ Add field'}
        </button>
      </div>
      {fields.length === 0 && (
        <p className="text-xs font-mono text-[var(--text-muted)]">{lang === 'ru' ? 'Нет полей' : 'No fields'}</p>
      )}
      {fields.map((cf, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input
            value={cf.key}
            onChange={e => onChange(fields.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
            placeholder={lang === 'ru' ? 'ключ' : 'key'}
            className="w-36 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
          />
          <input
            value={cf.value}
            onChange={e => onChange(fields.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
            placeholder={lang === 'ru' ? 'значение' : 'value'}
            className="flex-1 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-hover)]"
          />
          <button onClick={() => onChange(fields.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-[#ff4444] p-1">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── EntityFieldPicker: searchable entity selector for 'entity' field type ────

function EntityFieldPicker({
  label, required, value, onChange, lang,
}: {
  label: string; required: boolean; value: string;
  onChange: (entityId: string) => void; lang: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: entities = [] } = useQuery<Entity[]>({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 1000 }),
  });

  const { schemas } = useEntitySchemas();

  const filtered = entities.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const meta = (e.metadata || {}) as Record<string, string>;
    const name = e.type === 'person'
      ? [meta.last_name, meta.first_name, meta.middle_name].filter(Boolean).join(' ')
      : e.value;
    return name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  }).slice(0, 20);

  const selectedEntity = value ? entities.find(e => e.id === value) : null;

  const getEntityLabel = (e: Entity) => {
    const meta = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person'
      ? [meta.last_name, meta.first_name].filter(Boolean).join(' ') || e.value
      : e.value;
  };

  const getTypeLabel = (type: string) => {
    const schema = schemas.find(s => s.name === type);
    if (schema) return lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
    return type;
  };

  return (
    <div>
      <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
        {label}{required && <span className="text-[#ff4444] ml-1">*</span>}
        <span className="ml-1 text-[#3a4460]">· entity</span>
      </label>
      <div className="relative">
        <div
          onClick={() => setOpen(v => !v)}
          className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] cursor-pointer flex items-center justify-between hover:border-[var(--border-hover)]"
        >
          {selectedEntity ? (
            <span className="flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-xs">[{getTypeLabel(selectedEntity.type)}]</span>
              {getEntityLabel(selectedEntity)}
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">{lang === 'ru' ? 'Выбрать сущность...' : 'Select entity...'}</span>
          )}
          <Search size={12} className="text-[var(--text-muted)]" />
        </div>
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[var(--border-light)]">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'}
                className="w-full px-2 py-1.5 bg-[var(--bg-main)] border border-[var(--border-light)] rounded font-mono text-xs text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {value && (
                <button onClick={() => { onChange(''); setOpen(false); }}
                  className="w-full px-3 py-2 text-left font-mono text-xs text-[#ff4444] hover:bg-[#ff444410]">
                  ✕ {lang === 'ru' ? 'Сбросить' : 'Clear'}
                </button>
              )}
              {filtered.map(e => (
                <button
                  key={e.id}
                  onClick={() => { onChange(e.id); setOpen(false); setSearch(''); }}
                  className="w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--border)] flex items-center gap-2"
                  style={{ color: e.id === value ? 'var(--accent)' : '#e8edf5' }}
                >
                  <span className="text-[var(--text-muted)] text-[10px]">[{getTypeLabel(e.type)}]</span>
                  {getEntityLabel(e)}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                  {lang === 'ru' ? 'Не найдено' : 'No results'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EntitiesFieldPicker: multi-entity selector for 'entities' field type ─────

function EntitiesFieldPicker({
  label, required, value, onChange, lang,
}: {
  label: string; required: boolean; value: string;
  onChange: (v: string) => void; lang: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const { data: entities = [] } = useQuery<Entity[]>({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 1000 }),
  });
  const { schemas } = useEntitySchemas();

  // value stored as comma-separated IDs
  const selectedIds: string[] = value ? value.split(',').filter(Boolean) : [];

  const toggle = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onChange(next.join(','));
  };

  const getEntityLabel = (e: Entity) => {
    const meta = (e.metadata || {}) as Record<string, string>;
    return e.type === 'person'
      ? [meta.last_name, meta.first_name].filter(Boolean).join(' ') || e.value
      : e.value;
  };

  const getTypeLabel = (type: string) => {
    const schema = schemas.find(s => s.name === type);
    if (schema) return lang === 'ru' && schema.label_ru ? schema.label_ru : schema.label_en;
    return type;
  };

  const filtered = entities.filter(e => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return getEntityLabel(e).toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  }).slice(0, 30);

  return (
    <div>
      <label className="text-xs font-mono text-[var(--text-muted)] mb-1.5 block">
        {label}{required && <span className="text-[#ff4444] ml-1">*</span>}
        <span className="ml-1 text-[#3a4460]">· entities</span>
      </label>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {selectedIds.map(id => {
            const e = entities.find(x => x.id === id);
            if (!e) return null;
            return (
              <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-[var(--border)] rounded font-mono text-xs text-[var(--text-primary)]">
                {getEntityLabel(e)}
                <button onClick={() => toggle(id)} className="text-[var(--text-muted)] hover:text-[#ff4444] ml-1">×</button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-left flex items-center justify-between hover:border-[var(--border-hover)]"
        >
          <span className="text-[var(--text-muted)]">{lang === 'ru' ? '+ Добавить сущности...' : '+ Add entities...'}</span>
          <Search size={12} className="text-[var(--text-muted)]" />
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg shadow-xl overflow-hidden">
            <div className="p-2 border-b border-[var(--border-light)]">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'}
                className="w-full px-2 py-1.5 bg-[var(--bg-main)] border border-[var(--border-light)] rounded font-mono text-xs text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(e => (
                <button
                  key={e.id}
                  onClick={() => { toggle(e.id); setSearch(''); }}
                  className="w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--border)] flex items-center gap-2"
                  style={{ color: selectedIds.includes(e.id) ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  {selectedIds.includes(e.id) && <span className="text-[#00d4ff]">✓</span>}
                  <span className="text-[var(--text-muted)] text-[10px]">[{getTypeLabel(e.type)}]</span>
                  {getEntityLabel(e)}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
                  {lang === 'ru' ? 'Не найдено' : 'No results'}
                </p>
              )}
            </div>
            <div className="p-2 border-t border-[var(--border-light)]">
              <button onClick={() => setOpen(false)} className="w-full text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                {lang === 'ru' ? 'Закрыть' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GeoPositionPicker ────────────────────────────────────────────────────────

// Nominatim OSM types that represent an actual building (show apt form)
const BUILDING_TYPES = new Set([
  'house','residential','apartments','dormitory','detached','terrace',
  'semidetached_house','static_caravan','bungalow','cabin','farm',
  'building','construction','yes',
]);

interface GeoPositionPickerProps {
  label: string;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
  onAddressResolved?: (name: string, coords: string, meta?: Record<string,string>) => void;
  onExistingAddressPicked?: (id: string) => void;
  addressEntities?: any[];
  lang: string;
}

function GeoPositionPicker({
  label, required, value, onChange,
  onAddressResolved, onExistingAddressPicked,
  addressEntities = [], lang,
}: GeoPositionPickerProps) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<{ display_name: string; lat: string; lon: string; type?: string; class?: string }[]>([]);
  const [searching, setSearching]   = useState(false);
  const [showDrop, setShowDrop]     = useState(false);
  const [resolvedName, setResolvedName] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  // apt details
  const [isPrivate, setIsPrivate]   = useState(false);
  const [entrance, setEntrance]     = useState('');
  const [floor, setFloor]           = useState('');
  const [apartment, setApartment]   = useState('');
  const [intercom, setIntercom]     = useState('');
  // linked state
  const [linked, setLinked]         = useState(false);
  const [addrFilter, setAddrFilter] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [lat, lon] = value ? value.split(',') : ['',''];
  const osmUrl = value ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=16` : null;

  const search = async (q: string) => {
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`,
        { headers: { 'Accept-Language': lang === 'ru' ? 'ru' : 'en' } }
      );
      const data = await r.json();
      setResults(data); setShowDrop(true);
    } catch {/* ignore */}
    finally { setSearching(false); }
  };

  const onInput = (v: string) => {
    setQuery(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length >= 2) debRef.current = setTimeout(() => search(v), 380);
    else { setResults([]); setShowDrop(false); }
  };

  const pick = (r: typeof results[0]) => {
    const coords = `${parseFloat(r.lat).toFixed(6)},${parseFloat(r.lon).toFixed(6)}`;
    onChange(coords);
    setQuery(r.display_name);
    setResolvedName(r.display_name);
    const building = BUILDING_TYPES.has(r.type || '') || BUILDING_TYPES.has(r.class || '');
    setIsBuilding(building);
    setIsPrivate(false); setEntrance(''); setFloor(''); setApartment(''); setIntercom('');
    setLinked(false);
    setShowDrop(false); setResults([]);
  };

  const clear = () => {
    onChange(''); setQuery(''); setResolvedName(''); setResults([]);
    setShowDrop(false); setLinked(false); setIsBuilding(false);
    setIsPrivate(false); setEntrance(''); setFloor(''); setApartment(''); setIntercom('');
  };

  const save = () => {
    if (!value || !resolvedName) return;
    const meta: Record<string,string> = { coordinates: value };
    if (isBuilding) {
      meta.is_private = isPrivate ? 'true' : 'false';
      if (!isPrivate) {
        if (entrance)  meta.entrance  = entrance;
        if (floor)     meta.floor     = floor;
        if (apartment) meta.apartment = apartment;
        if (intercom)  meta.intercom  = intercom;
      }
    }
    onAddressResolved?.(resolvedName, value, meta);
    setLinked(true);
  };

  const pickExisting = (id: string) => {
    // Also populate the geo field with the existing entity's coordinates
    const entity = addressEntities.find((e: any) => e.id === id);
    const coords = entity ? ((entity.metadata || {}) as Record<string, string>).coordinates || '' : '';
    if (coords) {
      onChange(coords);
      setQuery(entity.value || '');
    }
    onExistingAddressPicked?.(id);
    setLinked(true);
  };

  const filteredExisting = addressEntities.filter((e: any) =>
    !addrFilter || e.value.toLowerCase().includes(addrFilter.toLowerCase())
  );

  const inputCls = "w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded-lg font-mono text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors";
  const smallInputCls = "w-full px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors";

  return (
    <div className="space-y-2">
      <label className="text-xs font-mono flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        📍 {label}{required && <span style={{ color: '#ff4444' }}>*</span>}
      </label>

      {/* ── Search ── */}
      <div className="relative">
        <input
          value={query}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && query.trim().length >= 2 && search(query)}
          placeholder={lang === 'ru' ? 'Поиск адреса...' : 'Search address...'}
          className={inputCls}
          style={{ paddingRight: '2.5rem' }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>
          {searching ? '⟳' : '🔍'}
        </span>

        {/* Dropdown */}
        {showDrop && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg shadow-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
            {results.map((r, i) => (
              <button key={i} type="button" onClick={() => pick(r)}
                className="w-full px-3 py-2.5 text-left hover:bg-[var(--bg-secondary)] transition-colors flex flex-col gap-0.5"
                style={{ borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{r.display_name}</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {parseFloat(r.lat).toFixed(5)}, {parseFloat(r.lon).toFixed(5)}
                  {(r.type || r.class) && <span className="ml-2 opacity-50">{r.type || r.class}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Selected location card ── */}
      {value && !linked && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {/* Header: coords + OSM + clear */}
          <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono text-xs" style={{ color: 'var(--accent)' }}>📌 {lat}, {lon}</span>
            <a href={osmUrl!} target="_blank" rel="noopener noreferrer"
              className="ml-auto font-mono text-[10px] underline" style={{ color: 'var(--text-muted)' }}>
              OpenStreetMap ↗
            </a>
            <button type="button" onClick={clear}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--border)] transition-colors"
              style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>

          {/* Apt details — only for actual buildings */}
          {onAddressResolved && isBuilding && (
            <div className="px-3 py-2.5 space-y-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              {/* Private house toggle */}
              <button type="button" onClick={() => setIsPrivate(v => !v)}
                className="flex items-center gap-2.5 w-full group">
                <div className="w-9 h-5 rounded-full flex items-center px-0.5 shrink-0 transition-all duration-200"
                  style={{ background: isPrivate ? '#a78bfa' : 'var(--border)' }}>
                  <div className="w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: isPrivate ? 'translateX(16px)' : 'translateX(0)' }} />
                </div>
                <span className="font-mono text-xs" style={{ color: isPrivate ? '#a78bfa' : 'var(--text-secondary)' }}>
                  {lang === 'ru' ? 'Частный дом' : 'Private house'}
                </span>
              </button>

              {/* Apt fields */}
              {!isPrivate && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Подъезд' : 'Entrance'}</div>
                    <input value={entrance} onChange={e => setEntrance(e.target.value)} className={smallInputCls} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Этаж' : 'Floor'}</div>
                    <input type="number" value={floor} onChange={e => setFloor(e.target.value)} className={smallInputCls} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Квартира' : 'Apartment'}</div>
                    <input value={apartment} onChange={e => setApartment(e.target.value)} className={smallInputCls} />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{lang === 'ru' ? 'Домофон' : 'Intercom'}</div>
                    <input value={intercom} onChange={e => setIntercom(e.target.value)} className={smallInputCls} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          {onAddressResolved && (
            <button type="button" onClick={save}
              className="w-full px-3 py-2 font-mono text-xs transition-colors hover:opacity-90"
              style={{ color: '#a78bfa', background: '#a78bfa10' }}>
              + {lang === 'ru' ? 'Создать сущность «Адрес» и привязать' : 'Create Address entity and link'}
            </button>
          )}
        </div>
      )}

      {/* ── Linked confirmation ── */}
      {linked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs"
          style={{ background: '#4ade8012', border: '1px solid #4ade8030', color: '#4ade80' }}>
          <span>✓</span>
          <span>{lang === 'ru' ? 'Адрес будет привязан при сохранении' : 'Address will be linked on save'}</span>
          <button type="button" onClick={() => setLinked(false)}
            className="ml-auto text-[10px] underline opacity-70 hover:opacity-100">
            {lang === 'ru' ? 'отмена' : 'undo'}
          </button>
        </div>
      )}

      {/* ── Existing addresses ── */}
      {onAddressResolved && addressEntities.length > 0 && !linked && (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru' ? 'Существующие адреса' : 'Existing addresses'}
            </span>
            <input value={addrFilter} onChange={e => setAddrFilter(e.target.value)}
              placeholder={lang === 'ru' ? 'фильтр...' : 'filter...'}
              className="ml-auto w-24 px-2 py-0.5 rounded font-mono text-xs outline-none bg-[var(--bg-main)] border border-[var(--border-light)] text-[var(--text-primary)]"
            />
          </div>
          <div className="max-h-28 overflow-y-auto">
            {filteredExisting.map((e: any) => {
              const m = (e.metadata || {}) as Record<string, string>;
              return (
                <button key={e.id} type="button" onClick={() => pickExisting(e.id)}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg-card)] transition-colors flex items-center gap-2"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: '#a78bfa', fontSize: 14 }}>📍</span>
                  <span className="font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>{e.value}</span>
                  {m.is_private === 'true' && <span className="ml-auto text-sm shrink-0">🏠</span>}
                  {m.apartment && (
                    <span className="ml-auto font-mono text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {lang === 'ru' ? 'кв.' : 'apt'} {m.apartment}
                    </span>
                  )}
                </button>
              );
            })}
            {filteredExisting.length === 0 && (
              <p className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Не найдено' : 'Nothing found'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}