import { useState } from 'react';
import { Settings, Sun, Moon, Clock, Globe, Check } from 'lucide-react';
import { useLang } from '../i18n/LangProvider';
import { useSettings, type Theme, type DateFormat } from '../context/SettingsContext';

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme, dateFormat, setDateFormat, formatDate } = useSettings();
  const [saved, setSaved] = useState(false);

  const now = new Date().toISOString();

  const handleSave = (fn: () => void) => {
    fn();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-[var(--accent)]" />
        <h2 className="text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );

  const OptionButton = ({ value, current, label, onClick }: {
    value: string; current: string; label: string; onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all ${
        current === value
          ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]'
          : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
      }`}
    >
      {current === value && <Check size={12} />}
      {label}
    </button>
  );

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Settings size={20} className="text-[var(--accent)]" /> {t.settings_title}
          </h1>
          <p className="text-sm text-[var(--text-muted)] font-mono mt-1">{t.settings_subtitle}</p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00ff8820] border border-[#00ff88] rounded-lg">
            <Check size={12} className="text-[#00ff88]" />
            <span className="text-xs font-mono text-[#00ff88]">{t.settings_saved}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Theme */}
        <Section icon={theme === 'dark' ? Moon : Sun} title={t.settings_theme}>
          <div className="flex gap-3">
            <OptionButton
              value="dark"
              current={theme}
              label={`🌙 ${t.settings_theme_dark}`}
              onClick={() => handleSave(() => setTheme('dark' as Theme))}
            />
            <OptionButton
              value="light"
              current={theme}
              label={`☀️ ${t.settings_theme_light}`}
              onClick={() => handleSave(() => setTheme('light' as Theme))}
            />
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">Preview</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <span className="text-sm">◆</span>
              </div>
              <div>
                <div className="text-sm font-mono text-[var(--text-primary)]">Entity name</div>
                <div className="text-xs font-mono text-[var(--text-muted)]">person · ID: abc123</div>
              </div>
            </div>
          </div>
        </Section>

        {/* Language */}
        <Section icon={Globe} title={t.settings_language}>
          <div className="flex gap-3">
            <OptionButton
              value="en"
              current={lang}
              label="🇬🇧 English"
              onClick={() => handleSave(() => setLang('en'))}
            />
            <OptionButton
              value="ru"
              current={lang}
              label="🇷🇺 Русский"
              onClick={() => handleSave(() => setLang('ru'))}
            />
          </div>
        </Section>

        {/* Date Format */}
        <Section icon={Clock} title={t.settings_date_format}>
          <div className="flex flex-col gap-2">
            {([
              { value: 'relative', label: `⏱ ${t.settings_date_relative}` },
              { value: 'short', label: `📅 ${t.settings_date_short}` },
              { value: 'full', label: `📆 ${t.settings_date_full}` },
            ] as { value: DateFormat; label: string }[]).map(({ value, label }) => (
              <OptionButton
                key={value}
                value={value}
                current={dateFormat}
                label={label}
                onClick={() => handleSave(() => setDateFormat(value))}
              />
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Preview</div>
            <div className="text-sm font-mono text-[var(--text-primary)]">{formatDate(now)}</div>
          </div>
        </Section>
      </div>
    </div>
  );
}
