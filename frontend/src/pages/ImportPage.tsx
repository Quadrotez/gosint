import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEntity } from '../api';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useLang } from '../i18n/LangProvider';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { useToast } from '../context/ToastContext';
import { Upload, FileText, ArrowRight, ArrowLeft, Check, AlertCircle, Loader2, X } from 'lucide-react';
import type { Entity } from '../types';

type Step = 'upload' | 'map' | 'preview' | 'done';

interface ColumnMapping {
  typeColumn: string | null;          // column that contains entity type
  valueColumn: string | null;         // column that contains entity value
  fixedType: string;                  // or use a fixed type for all rows
  useFixedType: boolean;
  extraColumns: string[];             // columns to include as metadata
  skipFirst: boolean;                 // treat first row as header
}

const DEFAULT_MAPPING: ColumnMapping = {
  typeColumn: null,
  valueColumn: null,
  fixedType: 'person',
  useFixedType: false,
  extraColumns: [],
  skipFirst: true,
};

export default function ImportPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { lang } = useLang();
  const { allTypeNames, getIcon, getColor } = useEntitySchemas();
  const toast = useToast();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [importing, setImporting] = useState(false);
  const [importedEntities, setImportedEntities] = useState<Entity[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const t = {
    title: lang === 'ru' ? 'Импорт данных из CSV' : 'Import Data from CSV',
    subtitle: lang === 'ru' ? 'Загрузите любой CSV и укажите, что означает каждая колонка' : 'Upload any CSV and map columns to entity fields',
    step1: lang === 'ru' ? 'Загрузка файла' : 'Upload File',
    step2: lang === 'ru' ? 'Маппинг колонок' : 'Map Columns',
    step3: lang === 'ru' ? 'Предпросмотр' : 'Preview',
    step4: lang === 'ru' ? 'Готово' : 'Done',
    drop: lang === 'ru' ? 'Перетащите CSV или нажмите для выбора' : 'Drop CSV here or click to browse',
    drop_hint: lang === 'ru' ? 'Поддерживается любой CSV-файл' : 'Any CSV file is supported',
    next: lang === 'ru' ? 'Далее' : 'Next',
    back: lang === 'ru' ? 'Назад' : 'Back',
    import: lang === 'ru' ? 'Импортировать' : 'Import',
    importing_text: lang === 'ru' ? 'Импортирую...' : 'Importing...',
    reset: lang === 'ru' ? 'Импортировать ещё' : 'Import another file',
    header_row: lang === 'ru' ? 'Первая строка — заголовки' : 'First row is headers',
    type_source: lang === 'ru' ? 'Откуда брать тип сущности' : 'Entity type source',
    type_from_column: lang === 'ru' ? 'Из колонки' : 'From column',
    type_fixed: lang === 'ru' ? 'Фиксированный тип для всех строк' : 'Fixed type for all rows',
    value_col: lang === 'ru' ? 'Колонка с основным значением' : 'Main value column',
    extra_cols: lang === 'ru' ? 'Дополнительные колонки → метаданные' : 'Extra columns → metadata',
    preview_title: lang === 'ru' ? 'Предпросмотр (первые 10 строк)' : 'Preview (first 10 rows)',
    preview_empty: lang === 'ru' ? 'Нет строк для импорта' : 'No rows to import',
    success: (n: number) => lang === 'ru' ? `Импортировано ${n} сущностей` : `Successfully imported ${n} entities`,
    errors: (n: number) => lang === 'ru' ? `Ошибок: ${n}` : `${n} errors`,
    required_hint: lang === 'ru' ? 'Укажите колонку или тип значения' : 'Value column is required',
    none: lang === 'ru' ? '— не выбрано —' : '— none —',
  };

  // Parse CSV
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim()); current = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(current.trim()); current = '';
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
    if (current || row.length) { row.push(current.trim()); if (row.some(c => c)) rows.push(row); }
    return rows;
  };

  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) return;
      setRawRows(rows);
      // Auto-detect headers
      const firstRow = rows[0];
      const looksLikeHeaders = firstRow.every(c => /^[a-zA-Zа-яёА-ЯЁ_\s]+$/.test(c));
      const hdrs = looksLikeHeaders ? firstRow : firstRow.map((_, i) => `col_${i + 1}`);
      setHeaders(hdrs);

      // Auto-map common column names
      const lower = hdrs.map(h => h.toLowerCase().trim());
      const typeIdx = lower.findIndex(h => h === 'type' || h === 'тип');
      const valueIdx = lower.findIndex(h => h === 'value' || h === 'значение' || h === 'name' || h === 'имя');
      setMapping({
        ...DEFAULT_MAPPING,
        skipFirst: looksLikeHeaders,
        typeColumn: typeIdx >= 0 ? hdrs[typeIdx] : null,
        valueColumn: valueIdx >= 0 ? hdrs[valueIdx] : hdrs[0] ?? null,
        useFixedType: typeIdx < 0,
        extraColumns: hdrs.filter((_, i) => i !== typeIdx && i !== valueIdx),
      });
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.csv')) handleFile(f);
  };

  // Build preview rows
  const dataRows = mapping.skipFirst ? rawRows.slice(1) : rawRows;
  const previewRows = dataRows.slice(0, 10);

  const resolveRow = (row: string[]): { type: string; value: string; metadata: Record<string, string> } | null => {
    const colIdx = (name: string | null) => name ? headers.indexOf(name) : -1;
    const typeIdx = mapping.useFixedType ? -1 : colIdx(mapping.typeColumn);
    const valueIdx = colIdx(mapping.valueColumn);

    const type = mapping.useFixedType ? mapping.fixedType : (row[typeIdx] || '').trim();
    const value = valueIdx >= 0 ? (row[valueIdx] || '').trim() : '';
    if (!type || !value) return null;

    const metadata: Record<string, string> = {};
    for (const col of mapping.extraColumns) {
      const idx = headers.indexOf(col);
      if (idx >= 0 && row[idx]) metadata[col] = row[idx];
    }
    return { type, value, metadata };
  };

  const handleImport = async () => {
    setImporting(true);
    const created: Entity[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const resolved = resolveRow(row);
      if (!resolved) { errors.push(`Row ${i + 1}: missing type or value`); continue; }
      try {
        const entity = await createEntity({
          type: resolved.type,
          value: resolved.value,
          metadata: Object.keys(resolved.metadata).length ? resolved.metadata : undefined,
        });
        created.push(entity);
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err?.response?.data?.detail || 'error'}`);
      }
    }

    setImportedEntities(created);
    setImportErrors(errors);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['entities'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });

    if (created.length > 0) toast.success(t.success(created.length));
    if (errors.length > 0) toast.error(t.errors(errors.length));
    setImporting(false);
  };

  const reset = () => {
    setStep('upload'); setFile(null); setRawRows([]); setHeaders([]);
    setMapping(DEFAULT_MAPPING); setImportedEntities([]); setImportErrors([]);
  };

  const canProceedMapping = mapping.valueColumn !== null;

  const StepIndicator = () => {
    const steps = [t.step1, t.step2, t.step3, t.step4];
    const stepKeys: Step[] = ['upload', 'map', 'preview', 'done'];
    const currentIdx = stepKeys.indexOf(step);
    return (
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              i === currentIdx ? 'text-[var(--accent)] bg-[var(--accent-dim)]' :
              i < currentIdx ? 'text-[#00ff88]' : 'text-[var(--text-muted)]'
            }`}>
              {i < currentIdx ? <Check size={11} /> : <span className="w-4 text-center">{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < steps.length - 1 && <div className="w-4 sm:w-6 h-px mx-1" style={{ background: 'var(--border)' }} />}
          </div>
        ))}
      </div>
    );
  };

  const ColSelect = ({ label, value, onChange, includeNone }: { label: string; value: string | null; onChange: (v: string | null) => void; includeNone?: boolean }) => (
    <div>
      <label className="text-[10px] font-mono uppercase tracking-widest block mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none appearance-none"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      >
        {includeNone && <option value="">{t.none}</option>}
        {headers.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{t.title}</h1>
        <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      <StepIndicator />

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-10 sm:p-16 text-center cursor-pointer transition-all group"
            style={{ borderColor: file ? 'var(--accent)' : 'var(--border)', background: file ? 'var(--accent-dim)' : undefined }}
          >
            <Upload size={28} className="mx-auto mb-3 transition-colors" style={{ color: file ? 'var(--accent)' : 'var(--text-muted)' }} />
            <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{t.drop}</p>
            <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.drop_hint}</p>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <FileText size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  ({rawRows.length} {lang === 'ru' ? 'строк' : 'rows'})
                </span>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {file && rawRows.length > 0 && (
            <>
              {/* Quick preview */}
              <div className="mt-4 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                  {lang === 'ru' ? 'Предпросмотр файла' : 'File preview'}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <tbody>
                      {rawRows.slice(0, 4).map((row, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-1.5 max-w-[140px] truncate" style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={() => setStep('map')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm transition-colors"
                  style={{ background: 'var(--accent)', color: 'var(--bg-main)' }}>
                  {t.next} <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2: Column Mapping */}
      {step === 'map' && (
        <div className="space-y-5">
          {/* Skip header row */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setMapping(m => ({ ...m, skipFirst: !m.skipFirst }))}
                className="w-9 h-5 rounded-full transition-colors flex items-center px-0.5"
                style={{ background: mapping.skipFirst ? 'var(--accent)' : 'var(--border)' }}>
                <div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: mapping.skipFirst ? 'translateX(16px)' : 'translateX(0)' }} />
              </div>
              <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{t.header_row}</span>
            </label>
          </div>

          {/* Type source */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.type_source}</div>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setMapping(m => ({ ...m, useFixedType: false }))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all"
                style={!mapping.useFixedType
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' }
                  : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
                {!mapping.useFixedType && <Check size={11} />} {t.type_from_column}
              </button>
              <button
                onClick={() => setMapping(m => ({ ...m, useFixedType: true }))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all"
                style={mapping.useFixedType
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' }
                  : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
                {mapping.useFixedType && <Check size={11} />} {t.type_fixed}
              </button>
            </div>

            {mapping.useFixedType ? (
              <div className="flex flex-wrap gap-2">
                {allTypeNames.map(type => {
                  const color = getColor(type);
                  return (
                    <button key={type} onClick={() => setMapping(m => ({ ...m, fixedType: type }))}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all"
                      style={mapping.fixedType === type
                        ? { borderColor: color, color, background: color + '18' }
                        : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
                      {getIcon(type)} {type}
                    </button>
                  );
                })}
              </div>
            ) : (
              <ColSelect label={lang === 'ru' ? 'Колонка с типом' : 'Type column'} value={mapping.typeColumn} onChange={v => setMapping(m => ({ ...m, typeColumn: v }))} includeNone />
            )}
          </div>

          {/* Value column */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <ColSelect label={t.value_col} value={mapping.valueColumn} onChange={v => setMapping(m => ({ ...m, valueColumn: v }))} />
          </div>

          {/* Extra columns */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.extra_cols}</div>
            <div className="flex flex-wrap gap-2">
              {headers.map(col => {
                const isExtra = mapping.extraColumns.includes(col);
                const isUsed = col === mapping.valueColumn || col === mapping.typeColumn;
                return (
                  <button key={col}
                    disabled={isUsed}
                    onClick={() => setMapping(m => ({
                      ...m,
                      extraColumns: isExtra ? m.extraColumns.filter(c => c !== col) : [...m.extraColumns, col],
                    }))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all disabled:opacity-30 disabled:cursor-default"
                    style={isExtra && !isUsed
                      ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-dim)' }
                      : { borderColor: 'var(--border-light)', color: 'var(--text-muted)' }}>
                    {isExtra && <Check size={10} />}
                    {col}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep('upload')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <ArrowLeft size={14} /> {t.back}
            </button>
            <button onClick={() => setStep('preview')} disabled={!canProceedMapping}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: 'var(--bg-main)' }}>
              {t.next} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview */}
      {step === 'preview' && (
        <div>
          <div className="text-sm font-mono mb-4" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? `Будет создано ${dataRows.length} сущностей` : `Will create ${dataRows.length} entities`}
          </div>

          {previewRows.length === 0 ? (
            <div className="text-center py-12 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{t.preview_empty}</div>
          ) : (
            <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: 'var(--border)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>Type</th>
                      <th className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>Value</th>
                      {mapping.extraColumns.map(c => (
                        <th key={c} className="px-3 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const resolved = resolveRow(row);
                      if (!resolved) return (
                        <tr key={i} className="border-t opacity-30" style={{ borderColor: 'var(--border)' }}>
                          <td colSpan={99} className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                            {lang === 'ru' ? 'Строка пропущена (нет типа или значения)' : 'Skipped (missing type or value)'}
                          </td>
                        </tr>
                      );
                      return (
                        <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-3 py-2">
                            <EntityTypeBadge type={resolved.type} size="sm" />
                          </td>
                          <td className="px-3 py-2 max-w-[180px] truncate" style={{ color: 'var(--text-primary)' }}>{resolved.value}</td>
                          {mapping.extraColumns.map(c => (
                            <td key={c} className="px-3 py-2 max-w-[100px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {resolved.metadata[c] || '—'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 10 && (
                <div className="px-4 py-2 border-t text-xs font-mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  +{dataRows.length - 10} {lang === 'ru' ? 'ещё строк' : 'more rows'}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep('map')} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-mono text-sm border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <ArrowLeft size={14} /> {t.back}
            </button>
            <button onClick={handleImport} disabled={importing || dataRows.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: 'var(--bg-main)' }}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? t.importing_text : t.import}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Done */}
      {step === 'done' && (
        <div className="space-y-4">
          {importedEntities.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl border" style={{ background: '#00ff8815', borderColor: '#00ff8840' }}>
              <Check size={18} style={{ color: '#00ff88' }} />
              <p className="font-mono text-sm" style={{ color: '#00ff88' }}>{t.success(importedEntities.length)}</p>
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ background: '#ff444410', borderColor: '#ff444440' }}>
              <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: '#ff444440' }}>
                <AlertCircle size={14} style={{ color: '#ff4444' }} />
                <span className="text-xs font-mono" style={{ color: '#ff6666' }}>{t.errors(importErrors.length)}</span>
              </div>
              <div className="max-h-32 overflow-y-auto p-3 space-y-1">
                {importErrors.map((e, i) => (
                  <p key={i} className="text-xs font-mono" style={{ color: '#ff8888' }}>{e}</p>
                ))}
              </div>
            </div>
          )}

          {importedEntities.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full">
                <tbody>
                  {importedEntities.slice(0, 20).map(entity => (
                    <tr key={entity.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5"><EntityTypeBadge type={entity.type} size="sm" /></td>
                      <td className="px-4 py-2.5 font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{entity.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importedEntities.length > 20 && (
                <div className="px-4 py-2.5 text-xs font-mono border-t" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  +{importedEntities.length - 20} more
                </div>
              )}
            </div>
          )}

          <button onClick={reset} className="w-full py-3 font-mono text-sm rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {t.reset}
          </button>
        </div>
      )}
    </div>
  );
}
