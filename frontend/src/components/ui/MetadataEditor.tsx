import { useState, useEffect } from 'react';
import { Plus, X, Check, Edit2 } from 'lucide-react';
import { useLang } from '../../i18n/LangProvider';

interface KVRow { key: string; val: string; }

function toRows(obj: Record<string, unknown>): KVRow[] {
  return Object.entries(obj).map(([key, val]) => ({
    key,
    val: typeof val === 'object' ? JSON.stringify(val) : String(val ?? ''),
  }));
}

function fromRows(rows: KVRow[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  rows.forEach(({ key, val }) => { if (key.trim()) result[key.trim()] = val; });
  return result;
}

interface Props {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  editable?: boolean;
}

export default function MetadataEditor({ value, onChange, editable = true }: Props) {
  const { lang } = useLang();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<KVRow[]>([]);

  useEffect(() => {
    if (!editing) setRows(toRows(value));
  }, [value, editing]);

  const save = () => { onChange(fromRows(rows)); setEditing(false); };
  const cancel = () => { setRows(toRows(value)); setEditing(false); };
  const addRow = () => setRows(r => [...r, { key: '', val: '' }]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: 'key' | 'val', v: string) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: v } : row));

  const displayRows = toRows(value);
  const LABEL = lang === 'ru' ? 'Метаданные' : 'Metadata';
  const EDIT = lang === 'ru' ? 'Редактировать' : 'Edit';
  const SAVE = lang === 'ru' ? 'Сохранить' : 'Save';
  const CANCEL = lang === 'ru' ? 'Отмена' : 'Cancel';
  const ADD = lang === 'ru' ? '+ Добавить поле' : '+ Add field';
  const EMPTY = lang === 'ru' ? 'Нет полей — нажмите «Редактировать»' : 'No fields — click Edit to add';

  if (!editing) {
    return (
      <div>
        {editable && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono text-[#7a8ba8] uppercase tracking-widest">{LABEL}</span>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs font-mono text-[var(--text-muted)] hover:text-[#00d4ff] transition-colors"
            >
              <Edit2 size={11} /> {EDIT}
            </button>
          </div>
        )}
        {displayRows.length > 0 ? (
          <div className="space-y-1.5">
            {displayRows.map(({ key, val }) => (
              <div key={key} className="flex gap-3 items-baseline">
                <span className="text-[11px] font-mono text-[var(--text-muted)] w-32 flex-shrink-0 truncate">{key}</span>
                <span className="text-xs font-mono text-[var(--text-primary)] break-all">{val}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-[var(--text-muted)]">{EMPTY}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-[#7a8ba8] uppercase tracking-widest">{LABEL}</span>
        <div className="flex gap-3">
          <button onClick={save} className="flex items-center gap-1 text-xs font-mono text-[#00d4ff] hover:text-[#00b8e0] transition-colors">
            <Check size={11} /> {SAVE}
          </button>
          <button onClick={cancel} className="text-xs font-mono text-[var(--text-muted)] hover:text-[#7a8ba8] transition-colors">
            {CANCEL}
          </button>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={row.key}
              onChange={e => updateRow(i, 'key', e.target.value)}
              placeholder={lang === 'ru' ? 'ключ' : 'key'}
              className="w-32 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#3a4460] flex-shrink-0"
            />
            <span className="text-[var(--text-muted)] font-mono text-xs">:</span>
            <input
              value={row.val}
              onChange={e => updateRow(i, 'val', e.target.value)}
              placeholder={lang === 'ru' ? 'значение' : 'value'}
              className="flex-1 px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[#3a4460]"
            />
            <button onClick={() => removeRow(i)} className="text-[var(--text-muted)] hover:text-[#ff4444] transition-colors p-1 flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="flex items-center gap-1 text-xs font-mono text-[#00d4ff] hover:underline">
        <Plus size={11} /> {ADD}
      </button>
    </div>
  );
}
