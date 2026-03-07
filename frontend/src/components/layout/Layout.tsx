import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSearchStore } from '../../store';
import { useLang } from '../../i18n/LangProvider';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Network, Search, Upload, Plus, GitBranch, Cpu, Shapes, Settings, Menu, X, User, Shield, LogOut } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { openSearch } = useSearchStore();
  const { t, lang } = useLang();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const NAV = [
    { path: '/', icon: LayoutDashboard, label: t.nav_dashboard },
    { path: '/entities', icon: Network, label: t.nav_entities },
    { path: '/graph', icon: GitBranch, label: t.nav_graph },
    { path: '/entity-types', icon: Shapes, label: lang === 'ru' ? 'Типы сущностей' : 'Entity Types' },
    { path: '/import', icon: Upload, label: t.nav_import },
    { path: '/create', icon: Plus, label: t.nav_new },
    { path: '/settings', icon: Settings, label: t.settings_title },
  ];

  const itemStyle = (active: boolean): React.CSSProperties => active
    ? { background: 'var(--border)', color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '10px' }
    : { color: 'var(--text-muted)' };

  const closeMobile = () => setMobileOpen(false);

  const UserMenu = () => (
    <div className="relative">
      <button
        onClick={() => setUserMenuOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg w-full text-left transition-colors hover:bg-[var(--bg-secondary)]"
      >
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
          style={{ background: 'var(--accent)', color: '#000' }}>
          {user?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <span className="text-xs font-mono truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{user?.username}</span>
      </button>

      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-1 z-20 rounded-lg py-1"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Link to="/profile" onClick={() => { setUserMenuOpen(false); closeMobile(); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-secondary)' }}>
              <User size={13} /> {lang === 'ru' ? 'Профиль' : 'Profile'}
            </Link>
            {user?.is_admin && (
              <Link to="/admin" onClick={() => { setUserMenuOpen(false); closeMobile(); }}
                className="flex items-center gap-2 px-3 py-2 text-xs font-mono transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--accent)' }}>
                <Shield size={13} /> {lang === 'ru' ? 'Админ-панель' : 'Admin Panel'}
              </Link>
            )}
            <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
            <button onClick={() => { logout(); setUserMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono w-full transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: '#f87171' }}>
              <LogOut size={13} /> {lang === 'ru' ? 'Выйти' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const NavContent = () => (
    <>
      <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Cpu size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-xs font-mono font-semibold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>OSINT</div>
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>Graph Platform</div>
          </div>
        </div>
        <button onClick={closeMobile} className="sm:hidden" style={{ color: 'var(--text-muted)' }}>
          <X size={16} />
        </button>
      </div>

      <button
        onClick={() => { openSearch(); closeMobile(); }}
        className="mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded transition-colors"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}
      >
        <Search size={13} />
        <span className="flex-1 text-left text-xs font-mono">{t.nav_search_placeholder}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded hidden sm:inline" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>⌘K</span>
      </button>

      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link key={path} to={path} onClick={closeMobile}
              className="flex items-center gap-3 px-3 py-2 rounded text-xs font-mono transition-colors"
              style={itemStyle(active)}>
              <Icon size={15} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <UserMenu />
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-56 flex-shrink-0 flex-col border-r" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <NavContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={closeMobile}
          style={{ background: 'rgba(0,0,0,0.6)' }} />
      )}

      {/* Mobile sidebar drawer */}
      <aside className={`sm:hidden fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col border-r transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <NavContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="sm:hidden flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <button onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-muted)' }}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Cpu size={16} style={{ color: 'var(--accent)' }} />
            <span className="text-xs font-mono font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>OSINT Graph</span>
          </div>
          <button onClick={openSearch} style={{ color: 'var(--text-muted)' }}>
            <Search size={18} />
          </button>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
