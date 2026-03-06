import { Link, useLocation } from 'react-router-dom';
import { useSearchStore } from '../../store';
import { useLang } from '../../i18n/LangProvider';
import { LayoutDashboard, Network, Search, Upload, Plus, GitBranch, Cpu, Shapes, Settings } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { openSearch } = useSearchStore();
  const { t, lang } = useLang();

  const NAV = [
    { path: '/', icon: LayoutDashboard, label: t.nav_dashboard },
    { path: '/entities', icon: Network, label: t.nav_entities },
    { path: '/graph', icon: GitBranch, label: t.nav_graph },
    { path: '/entity-types', icon: Shapes, label: lang === 'ru' ? 'Типы сущностей' : 'Entity Types' },
    { path: '/import', icon: Upload, label: t.nav_import },
    { path: '/create', icon: Plus, label: t.nav_new },
  ];

  const itemStyle = (active: boolean): React.CSSProperties => active
    ? { background: 'var(--border)', color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '10px' }
    : { color: 'var(--text-muted)' };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      <aside className="w-56 flex-shrink-0 flex flex-col border-r" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Cpu size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <div className="text-xs font-mono font-semibold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>OSINT</div>
              <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Graph Platform</div>
            </div>
          </div>
        </div>

        <button
          onClick={openSearch}
          className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded transition-colors"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
        >
          <Search size={13} />
          <span className="flex-1 text-left text-xs font-mono">{t.nav_search_placeholder}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>⌘K</span>
        </button>

        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className="flex items-center gap-3 px-3 py-2 rounded text-xs font-mono transition-colors"
                style={itemStyle(active)}
              >
                <Icon size={15} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 pb-2">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded text-xs font-mono transition-colors"
            style={itemStyle(location.pathname === '/settings')}
          >
            <Settings size={15} />
            <span>{t.settings_title}</span>
          </Link>
        </div>

        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.nav_version}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
