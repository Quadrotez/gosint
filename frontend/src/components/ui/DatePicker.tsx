import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAYS_EN = ['Mo','Tu','We','Th','Fr','Sa','Su'];

interface DatePickerProps {
  /** ISO value: YYYY-MM-DD or '' */
  value: string;
  onChange: (v: string) => void;
  dateLocale: 'dmy' | 'mdy' | 'ymd' | string;
  lang?: string;
  /** compact: no calendar icon row, just the 3 inputs */
  compact?: boolean;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** parse YYYY-MM-DD → {y,m,d} as strings, '' if missing */
function parseIso(iso: string): { y: string; m: string; d: string } {
  if (!iso) return { y: '', m: '', d: '' };
  const p = iso.split('-');
  return { y: p[0] ?? '', m: p[1] ?? '', d: p[2] ?? '' };
}

/** build YYYY-MM-DD from parts, return '' if incomplete */
function buildIso(y: string, m: string, d: string): string {
  if (y.length === 4 && m.length >= 1 && d.length >= 1) {
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

export default function DatePicker({ value, onChange, dateLocale, lang = 'ru', compact = false }: DatePickerProps) {
  const { y: iy, m: im, d: id } = parseIso(value);
  const [y, setY] = useState(iy);
  const [m, setM] = useState(im);
  const [d, setD] = useState(id);
  const [open, setOpen] = useState(false);

  // Calendar navigation state
  const today = new Date();
  const [calYear, setCalYear] = useState(() => iy ? parseInt(iy) : today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => im ? parseInt(im) - 1 : today.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync local state when parent value changes externally
  useEffect(() => {
    const { y: iy2, m: im2, d: id2 } = parseIso(value);
    setY(iy2); setM(im2); setD(id2);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const push = (ny: string, nm: string, nd: string) => {
    const iso = buildIso(ny, nm, nd);
    if (iso) onChange(iso);
    else if (!ny && !nm && !nd) onChange('');
  };

  const handleY = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 4);
    setY(clean);
    push(clean, m, d);
    if (clean.length === 4) {
      const n = parseInt(clean);
      if (n >= 1000 && n <= 2100) setCalYear(n);
    }
  };
  const handleM = (v: string) => {
    let clean = v.replace(/\D/g, '').slice(0, 2);
    const n = parseInt(clean);
    if (n > 12) clean = '12';
    if (clean.length === 2 && n < 1) clean = '01';
    setM(clean);
    push(y, clean, d);
    if (clean.length >= 1) setCalMonth(parseInt(clean) - 1);
  };
  const handleD = (v: string) => {
    let clean = v.replace(/\D/g, '').slice(0, 2);
    const maxD = (y && m) ? daysInMonth(parseInt(y), parseInt(m) - 1) : 31;
    const n = parseInt(clean);
    if (n > maxD) clean = String(maxD);
    if (clean.length === 2 && n < 1) clean = '01';
    setD(clean);
    push(y, m, clean);
  };

  const pickDay = (dayNum: number) => {
    const ny = String(calYear);
    const nm = String(calMonth + 1).padStart(2, '0');
    const nd = String(dayNum).padStart(2, '0');
    setY(ny); setM(nm); setD(nd);
    onChange(`${ny}-${nm}-${nd}`);
    setOpen(false);
  };

  const clear = () => {
    setY(''); setM(''); setD('');
    onChange('');
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const monthNames = lang === 'ru' ? MONTHS_RU : MONTHS_EN;
  const dayNames = lang === 'ru' ? DAYS_RU : DAYS_EN;

  const selectedDay = d ? parseInt(d) : null;
  const selectedMonth = m ? parseInt(m) - 1 : null;
  const selectedYear = y ? parseInt(y) : null;
  const isSelected = (day: number) =>
    day === selectedDay && calMonth === selectedMonth && calYear === selectedYear;

  const isToday = (day: number) =>
    day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

  // Build calendar grid (Monday-first)
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const totalDays = daysInMonth(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const inputCls = 'bg-[var(--bg-secondary)] border border-[var(--border-light)] rounded font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[#00d4ff60] text-center px-1 py-1.5 transition-colors';

  const renderInputs = () => {
    const yInput = <input key="y" value={y} onChange={e => handleY(e.target.value)} placeholder={lang === 'ru' ? 'ГГГГ' : 'YYYY'} className={inputCls} style={{ width: '54px' }} maxLength={4} />;
    const mInput = <input key="m" value={m} onChange={e => handleM(e.target.value)} placeholder={lang === 'ru' ? 'ММ' : 'MM'} className={inputCls} style={{ width: '40px' }} maxLength={2} />;
    const dInput = <input key="d" value={d} onChange={e => handleD(e.target.value)} placeholder={lang === 'ru' ? 'ДД' : 'DD'} className={inputCls} style={{ width: '40px' }} maxLength={2} />;
    const sep1 = <span key="s1" className="text-[var(--text-muted)] font-mono select-none">{dateLocale === 'ymd' ? '-' : dateLocale === 'mdy' ? '/' : '.'}</span>;
    const sep2 = <span key="s2" className="text-[var(--text-muted)] font-mono select-none">{dateLocale === 'ymd' ? '-' : dateLocale === 'mdy' ? '/' : '.'}</span>;
    if (dateLocale === 'mdy') return [mInput, sep1, dInput, sep2, yInput];
    if (dateLocale === 'ymd') return [yInput, sep1, mInput, sep2, dInput];
    return [dInput, sep1, mInput, sep2, yInput]; // dmy default
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <div className="flex items-center gap-1">
        {renderInputs()}
        {/* Calendar toggle */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          title={lang === 'ru' ? 'Открыть календарь' : 'Open calendar'}
          className="ml-1 p-1.5 rounded border border-[var(--border-light)] hover:border-[#3a4460] transition-colors"
          style={{ background: 'var(--bg-secondary)', color: open ? 'var(--accent)' : 'var(--text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="11" rx="1.5" />
            <path d="M5 1v4M11 1v4M2 7h12" />
          </svg>
        </button>
        {(y || m || d) && (
          <button type="button" onClick={clear} className="p-1 text-[var(--text-muted)] hover:text-[#ff4444] transition-colors">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Dropdown calendar */}
      {open && (
        <div
          className="absolute z-50 mt-2 rounded-xl shadow-2xl border"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            width: '240px',
            top: '100%',
            left: 0,
          }}
        >
          {/* Header: month/year nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <button onClick={prevMonth} className="p-1 rounded hover:bg-[var(--border)] text-[#7a8ba8] hover:text-[var(--text-primary)] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-xs text-[var(--text-primary)] font-semibold tracking-wide">
              {monthNames[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-[var(--border)] text-[#7a8ba8] hover:text-[var(--text-primary)] transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {dayNames.map(n => (
              <div key={n} className="text-center font-mono text-[9px] pb-1.5" style={{ color: 'var(--text-muted)' }}>{n}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 px-2 pb-2 gap-y-0.5">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const sel = isSelected(day);
              const tod = isToday(day);
              return (
                <button
                  key={i}
                  onClick={() => pickDay(day)}
                  className="w-7 h-7 mx-auto flex items-center justify-center rounded font-mono text-xs transition-all"
                  style={{
                    background: sel ? 'var(--accent)' : tod ? 'var(--border)' : 'transparent',
                    color: sel ? '#fff' : tod ? 'var(--accent)' : 'var(--text-primary)',
                    fontWeight: sel || tod ? 700 : 400,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick: today */}
          <div className="px-3 pb-2.5 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => {
                const t2 = new Date();
                const ty = String(t2.getFullYear());
                const tm = String(t2.getMonth() + 1).padStart(2, '0');
                const td = String(t2.getDate()).padStart(2, '0');
                setCalYear(t2.getFullYear()); setCalMonth(t2.getMonth());
                setY(ty); setM(tm); setD(td);
                onChange(`${ty}-${tm}-${td}`);
                setOpen(false);
              }}
              className="w-full text-center font-mono text-[10px] py-1.5 rounded hover:bg-[var(--border)] transition-colors"
              style={{ color: '#00d4ff' }}
            >
              {lang === 'ru' ? 'Сегодня' : 'Today'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
