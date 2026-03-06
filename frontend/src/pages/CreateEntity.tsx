import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntity } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { useLang } from '../i18n/LangProvider';
import { BUILTIN_ENTITY_TYPES, BUILTIN_FIELD_PRESETS } from '../utils';
import type { FieldDefinition } from '../types';
import { ArrowLeft, Plus, X, Camera, User } from 'lucide-react';

interface KVField { key: string; value: string; }

export default function CreateEntity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = useLang();
  const { schemas, allTypeNames, getColor, getIcon, getLabel } = useEntitySchemas();

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

  // Generic metadata fields
  const [metaFields, setMetaFields] = useState<KVField[]>([]);

  // Schema-defined field values
  const [schemaValues, setSchemaValues] = useState<Record<string, string>>({});

  const isPerson = type === 'person';
  const customSchema = schemas.find(s => s.name === type);
  const isBuiltin = BUILTIN_ENTITY_TYPES.includes(type);

  const fullName = isPerson
    ? [lastName, firstName, middleName].filter(Boolean).join(' ')
    : '';

  const mutation = useMutation({
    mutationFn: createEntity,
    onSuccess: (entity) => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
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
      personExtra.forEach(({ key, value: v }) => { if (key.trim()) m[key.trim()] = v; });
      metadata = Object.keys(m).length > 0 ? m : null;
    } else {
      const preset = BUILTIN_FIELD_PRESETS[type];
      const m: Record<string, unknown> = {};
      if (customSchema?.fields) {
        customSchema.fields.forEach(f => {
          const v = schemaValues[f.name];
          if (v) m[f.name] = v;
        });
      }
      // Add builtin preset field values
      if (preset) {
        preset.forEach(f => {
          const v = schemaValues[f.key];
          if (v) m[f.key] = v;
        });
      }
      metaFields.forEach(({ key, value: v }) => { if (key.trim()) m[key.trim()] = v; });
      // Auto-compose value for address if not entered
      if (!value.trim() && type === 'address') {
        const parts = ['city', 'street', 'building', 'apartment'].map(k => m[k]).filter(Boolean);
        entityValue = parts.join(', ') || (lang === 'ru' ? 'Адрес' : 'Address');
      } else {
        if (!value.trim()) return;
        entityValue = value.trim();
      }
      metadata = Object.keys(m).length > 0 ? m : null;
    }

    mutation.mutate({ type, value: entityValue, metadata });
  };

  const preset = BUILTIN_FIELD_PRESETS[type];
  const hasPresetValues = preset ? preset.some(f => schemaValues[f.key]?.trim()) : false;
  const canSubmit = isPerson ? true : value.trim().length > 0 || hasPresetValues;
  const color = getColor(type);
  const customTypes = schemas.filter(s => !s.is_builtin);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[#4a5568] hover:text-[#7a8ba8] mb-6 font-mono text-sm transition-colors"
      >
        <ArrowLeft size={14} /> {t.ep_back}
      </button>

      <h1 className="text-2xl font-mono font-semibold text-[#e8edf5] mb-1">{t.ce_title}</h1>
      <p className="text-sm text-[#4a5568] font-mono mb-8">{t.ce_subtitle}</p>

      <div className="bg-[#111318] border border-[#1e2330] rounded-xl p-6 space-y-6">

        {/* Type selector */}
        <div>
          <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-3 block">{t.ce_type_label}</label>

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
                } : { borderColor: '#262d3d', color: '#4a5568' }}
              >
                <span>{getIcon(ttype)}</span>
                <span className="truncate w-full text-center leading-tight">{getLabel(ttype)}</span>
              </button>
            ))}
          </div>

          {/* Custom types */}
          {customTypes.length > 0 && (
            <>
              <div className="text-[10px] font-mono text-[#4a5568] uppercase tracking-widest my-2">
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
                      } : { borderColor: '#262d3d', color: '#4a5568' }}
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
            <div className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest border-b border-[#1e2330] pb-2 flex items-center gap-2">
              <User size={12} /> {t.ce_person_title}
            </div>
            <p className="text-[11px] font-mono text-[#4a5568]">
              {lang === 'ru' ? 'Все поля необязательны' : 'All fields are optional'}
            </p>

            {/* Photo */}
            <div>
              <label className="text-xs font-mono text-[#4a5568] mb-2 block">{t.ce_person_photo}</label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => photoRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-[#262d3d] hover:border-[#00d4ff60] flex items-center justify-center cursor-pointer transition-colors overflow-hidden bg-[#181c24] relative group"
                >
                  {photo ? (
                    <>
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <Camera size={16} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <Camera size={20} className="text-[#4a5568] group-hover:text-[#00d4ff] transition-colors" />
                  )}
                </div>
                <div>
                  <button onClick={() => photoRef.current?.click()} className="text-xs font-mono text-[#00d4ff] hover:underline block mb-1">
                    {t.ce_person_photo_hint}
                  </button>
                  {photo && (
                    <button onClick={() => setPhoto(null)} className="text-xs font-mono text-[#4a5568] hover:text-[#ff4444]">
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
                  <label className="text-xs font-mono text-[#4a5568] mb-1.5 block">{label}</label>
                  <input
                    value={val}
                    onChange={e => set(e.target.value)}
                    placeholder={ph}
                    className="w-full px-3 py-2.5 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                  />
                </div>
              ))}
            </div>

            {/* DOB */}
            <div className="w-48">
              <label className="text-xs font-mono text-[#4a5568] mb-1.5 block">{t.ce_person_dob}</label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] outline-none focus:border-[#3a4460]"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            {/* Extra fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono text-[#4a5568]">{t.ce_person_custom}</label>
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
                    className="w-36 px-3 py-2 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-xs text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                  />
                  <input
                    value={cf.value}
                    onChange={e => setPersonExtra(f => f.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                    placeholder={t.ce_person_field_value}
                    className="flex-1 px-3 py-2 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-xs text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                  />
                  <button onClick={() => setPersonExtra(f => f.filter((_, idx) => idx !== i))} className="text-[#4a5568] hover:text-[#ff4444] p-1">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="rounded-lg p-3 font-mono text-xs border" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
              <span className="text-[#4a5568]">{t.ce_preview} </span>
              <span style={{ color }}>{getLabel(type)}</span>
              {fullName ? (
                <span className="text-[#e8edf5] ml-2">{fullName}</span>
              ) : (
                <span className="text-[#4a5568] ml-2 italic">{lang === 'ru' ? 'Неизвестная персона' : 'Unknown Person'}</span>
              )}
              {dob && <span className="text-[#4a5568] ml-2">· {dob}</span>}
            </div>
          </div>
        )}

        {/* ── CUSTOM TYPE WITH SCHEMA FIELDS ── */}
        {!isPerson && customSchema && customSchema.fields && customSchema.fields.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-2 block">
                {t.ce_value_label} <span className="text-[#ff4444]">*</span>
              </label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={`Enter ${getLabel(type)}...`}
                className="w-full px-4 py-3 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                style={{ borderColor: value ? `${color}60` : '' }}
              />
            </div>

            <div>
              <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-3 block">
                {lang === 'ru' ? 'Поля' : 'Fields'}
              </label>
              <div className="space-y-3">
                {customSchema.fields.map((f: FieldDefinition) => {
                  const label = (lang === 'ru' && f.label_ru) ? f.label_ru : f.label_en;
                  return (
                    <div key={f.name}>
                      <label className="text-xs font-mono text-[#4a5568] mb-1.5 block">
                        {label}
                        {f.required && <span className="text-[#ff4444] ml-1">*</span>}
                      </label>
                      <input
                        type={f.field_type === 'date' ? 'date' : f.field_type === 'number' ? 'number' : 'text'}
                        value={schemaValues[f.name] || ''}
                        onChange={e => setSchemaValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                        placeholder={f.name}
                        className="w-full px-3 py-2.5 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <MetaFieldsEditor fields={metaFields} onChange={setMetaFields} lang={lang} />

            {value && (
              <div className="rounded-lg p-3 font-mono text-xs border" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <span className="text-[#4a5568]">{t.ce_preview} </span>
                <span style={{ color }}>{getLabel(type)}</span>
                <span className="text-[#e8edf5] ml-2">{value}</span>
              </div>
            )}
          </div>
        )}

        {/* ── DEFAULT FORM (builtin non-person + custom without fields) ── */}
        {!isPerson && !(customSchema?.fields && customSchema.fields.length > 0) && (() => {
          const preset = BUILTIN_FIELD_PRESETS[type];
          return (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-2 block">
                {t.ce_value_label} <span className="text-[#ff4444]">*</span>
              </label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={`Enter ${getLabel(type)}...`}
                className="w-full px-4 py-3 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                style={{ borderColor: value ? `${color}60` : '' }}
              />
            </div>

            {preset && preset.length > 0 && (
              <div>
                <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-3 block">
                  {lang === 'ru' ? 'Поля' : 'Fields'}
                </label>
                <div className="space-y-3">
                  {preset.map(f => {
                    const label = (lang === 'ru') ? f.label_ru : f.label_en;
                    return (
                      <div key={f.key}>
                        <label className="text-xs font-mono text-[#4a5568] mb-1.5 block">{label}</label>
                        <input
                          type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                          value={schemaValues[f.key] || ''}
                          onChange={e => setSchemaValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={label}
                          className="w-full px-3 py-2.5 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <MetaFieldsEditor fields={metaFields} onChange={setMetaFields} lang={lang} />

            {value && (
              <div className="rounded-lg p-3 font-mono text-xs border" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <span className="text-[#4a5568]">{t.ce_preview} </span>
                <span style={{ color }}>{getLabel(type)}</span>
                <span className="text-[#e8edf5] ml-2">{value}</span>
              </div>
            )}
          </div>
          );
        })()}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          className="w-full py-3 bg-[#00d4ff] text-[#0a0c0f] font-mono text-sm font-semibold rounded-lg hover:bg-[#00b8e0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <label className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest">
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
        <p className="text-xs font-mono text-[#4a5568]">{lang === 'ru' ? 'Нет полей' : 'No fields'}</p>
      )}
      {fields.map((cf, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <input
            value={cf.key}
            onChange={e => onChange(fields.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
            placeholder={lang === 'ru' ? 'ключ' : 'key'}
            className="w-36 px-3 py-2 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-xs text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
          />
          <input
            value={cf.value}
            onChange={e => onChange(fields.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
            placeholder={lang === 'ru' ? 'значение' : 'value'}
            className="flex-1 px-3 py-2 bg-[#181c24] border border-[#262d3d] rounded-lg font-mono text-xs text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
          />
          <button onClick={() => onChange(fields.filter((_, idx) => idx !== i))} className="text-[#4a5568] hover:text-[#ff4444] p-1">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
