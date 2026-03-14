import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type DateFormat = 'relative' | 'short' | 'full';
export type DateLocale = 'dmy' | 'mdy' | 'ymd';

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  dateFormat: DateFormat;
  setDateFormat: (f: DateFormat) => void;
  dateLocale: DateLocale;
  setDateLocale: (l: DateLocale) => void;
  formatDate: (dateStr: string) => string;
  smartParse: boolean;
  setSmartParse: (v: boolean) => void;
}

const SettingsCtx = createContext<SettingsContextType>({
  theme: 'dark',
  setTheme: () => {},
  dateFormat: 'short',
  setDateFormat: () => {},
  dateLocale: 'dmy',
  setDateLocale: () => {},
  formatDate: (d) => d,
  smartParse: true,
  setSmartParse: () => {},
});

function formatRelative(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  const month = Math.floor(day / 30);

  if (lang === 'ru') {
    if (sec < 60) return 'только что';
    if (min < 60) return `${min} мин. назад`;
    if (hr < 24) return `${hr} ч. назад`;
    if (day < 7) return `${day} дн. назад`;
    if (week < 4) return `${week} нед. назад`;
    return `${month} мес. назад`;
  }
  if (sec < 60) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  if (week < 4) return `${week}w ago`;
  return `${month}mo ago`;
}

function formatWithLocale(date: Date, format: DateFormat, locale: DateLocale, lang: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const H = pad(date.getHours());
  const M = pad(date.getMinutes());
  const time = `${H}:${M}`;

  const monthNames = {
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
  };

  if (format === 'full') {
    const monthName = monthNames[lang === 'ru' ? 'ru' : 'en'][date.getMonth()];
    if (locale === 'mdy') return `${monthName} ${d}, ${y} ${time}`;
    if (locale === 'ymd') return `${y}-${m}-${d} ${time}`;
    // dmy default
    return `${d} ${monthName} ${y} ${time}`;
  }

  // short
  if (locale === 'mdy') return `${m}/${d}/${y} ${time}`;
  if (locale === 'ymd') return `${y}-${m}-${d} ${time}`;
  return `${d}.${m}.${y} ${time}`;
}

export function SettingsProvider({ children, lang }: { children: ReactNode; lang: string }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('osint_theme') as Theme) || 'dark'
  );
  const [dateFormat, setDateFormatState] = useState<DateFormat>(
    () => (localStorage.getItem('osint_date_format') as DateFormat) || 'short'
  );
  const [dateLocale, setDateLocaleState] = useState<DateLocale>(
    () => (localStorage.getItem('osint_date_locale') as DateLocale) || 'dmy'
  );
  const [smartParse, setSmartParseState] = useState<boolean>(
    () => localStorage.getItem('osint_smart_parse') !== 'false'
  );

  const setTheme = (t: Theme) => { setThemeState(t); localStorage.setItem('osint_theme', t); };
  const setDateFormat = (f: DateFormat) => { setDateFormatState(f); localStorage.setItem('osint_date_format', f); };
  const setDateLocale = (l: DateLocale) => { setDateLocaleState(l); localStorage.setItem('osint_date_locale', l); };
  const setSmartParse = (v: boolean) => { setSmartParseState(v); localStorage.setItem('osint_smart_parse', String(v)); };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.classList.add('theme-light');
    else root.classList.remove('theme-light');
  }, [theme]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      if (dateFormat === 'relative') return formatRelative(dateStr, lang);
      return formatWithLocale(date, dateFormat, dateLocale, lang);
    } catch {
      return dateStr;
    }
  };

  return (
    <SettingsCtx.Provider value={{ theme, setTheme, dateFormat, setDateFormat, dateLocale, setDateLocale, formatDate, smartParse, setSmartParse }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);
