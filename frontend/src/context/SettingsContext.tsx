import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'dark' | 'light';
export type DateFormat = 'relative' | 'short' | 'full';

interface SettingsContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  dateFormat: DateFormat;
  setDateFormat: (f: DateFormat) => void;
  formatDate: (dateStr: string) => string;
}

const SettingsCtx = createContext<SettingsContextType>({
  theme: 'dark',
  setTheme: () => {},
  dateFormat: 'short',
  setDateFormat: () => {},
  formatDate: (d) => d,
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

export function SettingsProvider({ children, lang }: { children: ReactNode; lang: string }) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('osint_theme') as Theme) || 'dark'
  );
  const [dateFormat, setDateFormatState] = useState<DateFormat>(
    () => (localStorage.getItem('osint_date_format') as DateFormat) || 'short'
  );

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('osint_theme', t);
  };

  const setDateFormat = (f: DateFormat) => {
    setDateFormatState(f);
    localStorage.setItem('osint_date_format', f);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.remove('theme-light');
    }
  }, [theme]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '—';
    try {
      if (dateFormat === 'relative') return formatRelative(dateStr, lang);
      if (dateFormat === 'short') {
        return new Date(dateStr).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      }
      // full
      return new Date(dateStr).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SettingsCtx.Provider value={{ theme, setTheme, dateFormat, setDateFormat, formatDate }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);
