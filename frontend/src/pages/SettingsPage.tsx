import React, { useState, useRef } from 'react';
import {
  Settings, Sun, Moon, Clock, Globe, Check, Download, Upload,
  Cloud, UploadCloud, DownloadCloud, RefreshCw, TestTube, Wifi, WifiOff,
  Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import { useLang } from '../i18n/LangProvider';
import { useSettings, type Theme, type DateFormat, type DateLocale } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { exportBackup, importBackup, webdavTest, webdavPush, webdavPull, webdavSync, type WebDAVConfig } from '../api';

// ─── HOisted components — must be outside the page component to avoid remounting ──

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={15} className="text-[var(--accent)]" />
        <h2 className="text-xs font-mono font-semibold text-[var(--text-muted)] uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function OptionButton({ value, current, label, onClick }: {
  value: string; current: string; label: string; onClick: () => void;
}) {
  const active = current === value;
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all ${
      active
        ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]'
        : 'border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
    }`}>
      {active && <Check size={12} />}
      {label}
    </button>
  );
}

// ─── WebDAV section — memoized so it doesn't remount on parent re-renders ─────

const WebDAVSection = React.memo(function WebDAVSection({ lang, toast }: { lang: string; toast: any }) {
  const [wdUrl,  setWdUrl]  = useState(() => localStorage.getItem('wd_url')  || '');
  const [wdUser, setWdUser] = useState(() => localStorage.getItem('wd_user') || '');
  const [wdPass, setWdPass] = useState('');
  const [wdFile, setWdFile] = useState(() => localStorage.getItem('wd_file') || 'osint_backup.zip');
  const [wdLoading, setWdLoading] = useState<string | null>(null);
  const [wdConnected, setWdConnected] = useState<boolean | null>(null);
  const [showPass, setShowPass] = useState(false);

  const inputCls = "w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors";

  const saveWdSettings = () => {
    localStorage.setItem('wd_url', wdUrl);
    localStorage.setItem('wd_user', wdUser);
    localStorage.setItem('wd_file', wdFile);
  };
  const wdCfg = (): WebDAVConfig => ({ url: wdUrl, username: wdUser, password: wdPass, filename: wdFile });

  const handleWdTest = async () => {
    setWdLoading('test'); saveWdSettings();
    try { await webdavTest(wdCfg()); setWdConnected(true); toast.success(lang === 'ru' ? 'Подключение успешно' : 'Connection OK'); }
    catch (e: any) { setWdConnected(false); toast.error(`WebDAV: ${e?.response?.data?.detail || 'failed'}`); }
    finally { setWdLoading(null); }
  };
  const handleWdPush = async () => {
    setWdLoading('push'); saveWdSettings();
    try { const r = await webdavPush(wdCfg()); toast.success(`Pushed ${(r.bytes/1024).toFixed(1)} KB`); }
    catch (e: any) { toast.error(`Push: ${e?.response?.data?.detail || 'error'}`); }
    finally { setWdLoading(null); }
  };
  const handleWdPull = async () => {
    setWdLoading('pull'); saveWdSettings();
    try { const r = await webdavPull(wdCfg()); toast.success(`Pulled: +${r.merged.entities} entities`); }
    catch (e: any) { toast.error(`Pull: ${e?.response?.data?.detail || 'error'}`); }
    finally { setWdLoading(null); }
  };
  const handleWdSync = async () => {
    setWdLoading('sync'); saveWdSettings();
    try { const r = await webdavSync(wdCfg()); toast.success(`Synced: +${r.pulled.entities} merged, pushed ${(r.pushed_bytes/1024).toFixed(1)} KB`); }
    catch (e: any) { toast.error(`Sync: ${e?.response?.data?.detail || 'error'}`); }
    finally { setWdLoading(null); }
  };

  const wdDisabled = !wdUrl || !wdUser || !wdPass || wdLoading !== null;

  return (
    <Section icon={Cloud} title={lang === 'ru' ? 'Синхронизация WebDAV' : 'WebDAV Sync'}>
      <p className="text-xs font-mono text-[var(--text-muted)] mb-4">
        {lang === 'ru'
          ? 'Двусторонняя синхронизация с Nextcloud, ownCloud или любым WebDAV-сервером.'
          : 'Bidirectional sync with Nextcloud, ownCloud or any WebDAV server.'}
      </p>
      <div className="space-y-3 mb-4">
        <div>
          <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-1">URL</label>
          <input value={wdUrl} onChange={e => setWdUrl(e.target.value)}
            placeholder="https://cloud.example.com/remote.php/dav/files/user/osint/"
            className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-1">
              {lang === 'ru' ? 'Логин' : 'Username'}
            </label>
            <input value={wdUser} onChange={e => setWdUser(e.target.value)} placeholder="username" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-1">
              {lang === 'ru' ? 'Пароль' : 'Password'}
            </label>
            <div className="relative">
              <input value={wdPass} onChange={e => setWdPass(e.target.value)} type={showPass ? 'text' : 'password'}
                placeholder="••••••••" className={inputCls + ' pr-8'} />
              <button onClick={() => setShowPass(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-1">
            {lang === 'ru' ? 'Имя файла' : 'Filename'}
          </label>
          <input value={wdFile} onChange={e => setWdFile(e.target.value)} placeholder="osint_backup.zip" className={inputCls} />
        </div>
      </div>

      {wdConnected !== null && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs font-mono border ${wdConnected ? 'bg-[#00ff8810] border-[#00ff8840] text-[#00ff88]' : 'bg-[#ff444410] border-[#ff444440] text-[#ff6666]'}`}>
          {wdConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {wdConnected ? (lang === 'ru' ? 'Подключение работает' : 'Connection OK') : (lang === 'ru' ? 'Не удалось подключиться' : 'Connection failed')}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([
          { op: 'test', icon: TestTube,     label: lang === 'ru' ? 'Тест'           : 'Test',  fn: handleWdTest },
          { op: 'push', icon: UploadCloud,  label: lang === 'ru' ? 'Отправить'      : 'Push',  fn: handleWdPush },
          { op: 'pull', icon: DownloadCloud,label: lang === 'ru' ? 'Получить'       : 'Pull',  fn: handleWdPull },
          { op: 'sync', icon: RefreshCw,    label: lang === 'ru' ? 'Синхронизировать':'Sync',  fn: handleWdSync },
        ] as {op:string; icon:any; label:string; fn:()=>void}[]).map(({ op, icon: Icon, label, fn }) => (
          <button key={op} onClick={fn} disabled={wdDisabled}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs transition-all border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed">
            <Icon size={13} className={wdLoading === op ? 'animate-spin' : ''} />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 text-[11px] font-mono text-[var(--text-muted)]">
        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
        {lang === 'ru' ? 'Пароль не сохраняется между сессиями.' : 'Password is never persisted — re-enter each session.'}
      </div>
    </Section>
  );
});

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { theme, setTheme, dateFormat, setDateFormat, dateLocale, setDateLocale, formatDate } = useSettings();
  const toast = useToast();
  const [saved, setSaved] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const now = new Date().toISOString();

  const handleSave = (fn: () => void) => { fn(); setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const handleExport = async () => {
    setBackupLoading(true);
    try {
      const blob = await exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `osint_backup_${new Date().toISOString().slice(0, 10)}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success(lang === 'ru' ? 'База данных экспортирована' : 'Database exported');
    } catch { toast.error(lang === 'ru' ? 'Ошибка экспорта' : 'Export failed'); }
    finally { setBackupLoading(false); }
  };

  const handleImportFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) { toast.error(lang === 'ru' ? 'Нужен .zip файл' : 'Select a .zip file'); return; }
    setBackupLoading(true);
    try {
      const result = await importBackup(file);
      const s = result.imported;
      toast.success(lang === 'ru'
        ? `Импортировано: ${s.entities} сущ., ${s.relationships} связей (пропущено: ${s.skipped})`
        : `Imported: ${s.entities} entities, ${s.relationships} rels (skipped: ${s.skipped})`);
    } catch { toast.error(lang === 'ru' ? 'Ошибка импорта' : 'Import failed'); }
    finally { setBackupLoading(false); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
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
        <Section icon={theme === 'dark' ? Moon : Sun} title={t.settings_theme}>
          <div className="flex flex-wrap gap-3">
            <OptionButton value="dark"  current={theme} label={`🌙 ${t.settings_theme_dark}`}  onClick={() => handleSave(() => setTheme('dark' as Theme))} />
            <OptionButton value="light" current={theme} label={`☀️ ${t.settings_theme_light}`} onClick={() => handleSave(() => setTheme('light' as Theme))} />
          </div>
        </Section>

        <Section icon={Globe} title={t.settings_language}>
          <div className="flex flex-wrap gap-3">
            <OptionButton value="en" current={lang} label="🇬🇧 English" onClick={() => handleSave(() => setLang('en'))} />
            <OptionButton value="ru" current={lang} label="🇷🇺 Русский" onClick={() => handleSave(() => setLang('ru'))} />
          </div>
        </Section>

        <Section icon={Clock} title={t.settings_date_format}>
          <div className="flex flex-col gap-2 mb-4">
            {([
              { value: 'relative', label: `⏱ ${t.settings_date_relative}` },
              { value: 'short',    label: `📅 ${t.settings_date_short}` },
              { value: 'full',     label: `📆 ${t.settings_date_full}` },
            ] as { value: DateFormat; label: string }[]).map(({ value, label }) => (
              <OptionButton key={value} value={value} current={dateFormat} label={label}
                onClick={() => handleSave(() => setDateFormat(value))} />
            ))}
          </div>
          {dateFormat !== 'relative' && (
            <>
              <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-2">
                {lang === 'ru' ? 'Порядок даты' : 'Date order'}
              </div>
              <div className="flex flex-col gap-2 mb-4">
                <OptionButton value="dmy" current={dateLocale} label="DD.MM.YYYY — Россия / Европа" onClick={() => handleSave(() => setDateLocale('dmy' as DateLocale))} />
                <OptionButton value="mdy" current={dateLocale} label="MM/DD/YYYY — USA"              onClick={() => handleSave(() => setDateLocale('mdy' as DateLocale))} />
                <OptionButton value="ymd" current={dateLocale} label="YYYY-MM-DD — ISO 8601"         onClick={() => handleSave(() => setDateLocale('ymd' as DateLocale))} />
              </div>
            </>
          )}
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mb-1">Preview</div>
            <div className="text-sm font-mono text-[var(--text-primary)]">{formatDate(now)}</div>
          </div>
        </Section>

        <Section icon={Download} title={lang === 'ru' ? 'Резервная копия базы данных' : 'Database Backup'}>
          <p className="text-xs font-mono text-[var(--text-muted)] mb-4">
            {lang === 'ru'
              ? 'Экспорт сохраняет все сущности, связи, схемы и фотографии в один ZIP-файл. При импорте дубликаты пропускаются.'
              : 'Export saves all entities, relationships, schemas and photos into one ZIP. On import, duplicates are skipped.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleExport} disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={14} className={backupLoading ? 'animate-bounce' : ''} />
              {lang === 'ru' ? 'Экспортировать .zip' : 'Export .zip'}
            </button>
            <button onClick={() => importRef.current?.click()} disabled={backupLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-sm transition-all border-[var(--border-light)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed">
              <Upload size={14} />
              {lang === 'ru' ? 'Импортировать .zip' : 'Import .zip'}
            </button>
            <input ref={importRef} type="file" accept=".zip" className="hidden"
              onChange={e => e.target.files?.[0] && handleImportFile(e.target.files[0])} />
          </div>
        </Section>

        <WebDAVSection lang={lang} toast={toast} />
      </div>
    </div>
  );
}
