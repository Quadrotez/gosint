import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStats } from '../api';
import { getPersonDisplayName } from '../utils';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { Network, GitBranch, Clock, TrendingUp } from 'lucide-react';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useSearchStore } from '../store';
import { useLang } from '../i18n/LangProvider';
import { useSettings } from '../context/SettingsContext';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 30000,
  });

  const { openSearch } = useSearchStore();
  const { t } = useLang();
  const { formatDate } = useSettings();
  const { getColor, getIcon, getLabel } = useEntitySchemas();

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-full">
      <div className="text-[var(--text-muted)] font-mono text-sm animate-pulse">{t.loading}</div>
    </div>
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-mono font-semibold text-[var(--text-primary)] tracking-tight">{t.dash_title}</h1>
        <p className="text-sm text-[var(--text-muted)] font-mono mt-1">{t.dash_subtitle}</p>
      </div>

      <button
        onClick={openSearch}
        className="w-full mb-8 flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl text-[var(--text-muted)] text-sm font-mono hover:border-[var(--border-hover)] transition-colors group"
      >
        <span>⌕</span>
        <span className="flex-1 text-left">{t.dash_search_placeholder}</span>
        <kbd className="text-[11px] bg-[var(--border)] px-2 py-1 rounded border border-[var(--border-light)] group-hover:border-[var(--border-hover)]">⌘K</kbd>
      </button>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard
          icon={<Network size={20} className="text-[#00d4ff]" />}
          label={t.dash_total_entities}
          value={stats?.total_entities ?? 0}
          color="#00d4ff"
        />
        <StatCard
          icon={<GitBranch size={20} className="text-[#00ff88]" />}
          label={t.dash_relationships}
          value={stats?.total_relationships ?? 0}
          color="#00ff88"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={14} className="text-[var(--text-muted)]" />
            <h2 className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">{t.dash_by_type}</h2>
          </div>
          <div className="space-y-2">
            {stats && Object.entries(stats.entities_by_type)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const color = getColor(type);
                const max = Math.max(...Object.values(stats.entities_by_type));
                return (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-sm w-5 text-center">{getIcon(type)}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-mono text-[var(--text-muted)]">{getLabel(type)}</span>
                        <span className="text-xs font-mono" style={{ color }}>{count}</span>
                      </div>
                      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${(count / max) * 100}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            {(!stats || Object.keys(stats.entities_by_type).length === 0) && (
              <p className="text-xs text-[var(--text-muted)] font-mono">{t.dash_no_entities}</p>
            )}
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} className="text-[var(--text-muted)]" />
            <h2 className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">{t.dash_recent}</h2>
          </div>
          <div className="space-y-2">
            {stats?.recent_entities.map(entity => {
              const displayName = entity.type === 'person'
                ? getPersonDisplayName(entity)
                : entity.value;
              const meta = (entity.metadata || {}) as Record<string, string>;
              return (
                <Link
                  key={entity.id}
                  to={`/entities/${entity.id}`}
                  className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0 hover:opacity-80 transition-opacity"
                >
                  {entity.type === 'person' && meta.photo
                    ? <img src={meta.photo} alt="" className="w-6 h-6 rounded-full object-cover border border-[var(--border-light)]" />
                    : <EntityTypeBadge type={entity.type} size="sm" />
                  }
                  <span className="flex-1 text-xs font-mono text-[var(--text-primary)] truncate">{displayName}</span>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{formatDate(entity.created_at)}</span>
                </Link>
              );
            })}
            {(!stats || stats.recent_entities.length === 0) && (
              <p className="text-xs text-[var(--text-muted)] font-mono">{t.dash_no_entities}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { to: '/create', label: t.dash_action_new, desc: t.dash_action_new_desc },
          { to: '/entities', label: t.dash_action_browse, desc: t.dash_action_browse_desc },
          { to: '/graph', label: t.dash_action_graph, desc: t.dash_action_graph_desc },
        ].map(({ to, label, desc }) => (
          <Link key={to} to={to} className="bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--border-hover)] rounded-xl p-4 transition-colors group">
            <div className="text-sm font-mono text-[var(--text-primary)] mb-1 group-hover:text-[#00d4ff] transition-colors">{label}</div>
            <div className="text-xs font-mono text-[var(--text-muted)]">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        {icon}
        <div className="text-3xl font-mono font-semibold" style={{ color }}>{value.toLocaleString()}</div>
      </div>
      <div className="text-xs font-mono text-[var(--text-muted)] uppercase tracking-widest">{label}</div>
    </div>
  );
}
