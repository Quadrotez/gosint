import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntities, deleteEntity } from '../api';
import { getPersonDisplayName } from '../utils';
import { useSettings } from '../context/SettingsContext';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useLang } from '../i18n/LangProvider';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Search, Trash2, ExternalLink, Filter } from 'lucide-react';

export default function Entities() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { t } = useLang();
  const { formatDate } = useSettings();
  const { allTypeNames, getLabel } = useEntitySchemas();

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', typeFilter],
    queryFn: () => getEntities({ limit: 500, type: typeFilter || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const filtered = entities.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    const meta = (e.metadata || {}) as Record<string, string>;
    const displayName = e.type === 'person'
      ? getPersonDisplayName(e).toLowerCase()
      : e.value.toLowerCase();
    return (
      displayName.includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.value.toLowerCase().includes(q) ||
      Object.values(meta).some(v => String(v).toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold text-[#e8edf5]">{t.ent_title}</h1>
          <p className="text-sm text-[#4a5568] font-mono mt-1">{t.ent_subtitle_count(entities.length)}</p>
        </div>
        <Link to="/create" className="px-4 py-2 bg-[#00d4ff] text-[#0a0c0f] font-mono text-sm font-semibold rounded-lg hover:bg-[#00b8e0] transition-colors">
          {t.ent_new}
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.ent_filter_placeholder}
            className="w-full pl-9 pr-4 py-2 bg-[#111318] border border-[#262d3d] rounded-lg text-sm font-mono text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460] transition-colors"
          />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5568]" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-[#111318] border border-[#262d3d] rounded-lg text-sm font-mono text-[#e8edf5] outline-none focus:border-[#3a4460] appearance-none cursor-pointer"
          >
            <option value="">{t.ent_all_types}</option>
            {allTypeNames.map(typeName => (
              <option key={typeName} value={typeName}>{getLabel(typeName)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-[#111318] border border-[#1e2330] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e2330]">
              {[t.ent_col_type, t.ent_col_value, t.ent_col_meta, t.ent_col_created, ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[10px] font-mono text-[#4a5568] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#4a5568] font-mono text-sm">{t.ent_loading}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[#4a5568] font-mono text-sm">
                {search || typeFilter ? t.ent_empty_filter : t.ent_empty}
              </td></tr>
            ) : filtered.map(entity => {
              const meta = (entity.metadata || {}) as Record<string, string>;
              const displayName = entity.type === 'person'
                ? getPersonDisplayName(entity)
                : entity.value;
              return (
                <tr key={entity.id} className="border-b border-[#1e2330] last:border-0 hover:bg-[#181c24] transition-colors group">
                  <td className="px-4 py-3">
                    <EntityTypeBadge type={entity.type} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {entity.type === 'person' && meta.photo && (
                        <img src={meta.photo} alt="" className="w-6 h-6 rounded-full object-cover border border-[#262d3d] flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-mono text-sm text-[#e8edf5]">{displayName}</span>
                        {entity.type === 'person' && meta.dob && (
                          <div className="text-[10px] font-mono text-[#4a5568]">🎂 {meta.dob}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {entity.metadata && Object.keys(entity.metadata).length > 0 ? (
                      <span className="font-mono text-xs text-[#4a5568] truncate max-w-[180px] block">
                        {Object.keys(entity.metadata).filter(k => k !== 'photo').slice(0, 3).join(', ')}
                      </span>
                    ) : <span className="text-[#4a5568] text-xs font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-[#4a5568]">{formatDate(entity.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link to={`/entities/${entity.id}`} className="p-1.5 rounded hover:bg-[#262d3d] text-[#7a8ba8] hover:text-[#00d4ff] transition-colors">
                        <ExternalLink size={13} />
                      </Link>
                      <button
                        onClick={() => setConfirmId(entity.id)}
                        className="p-1.5 rounded hover:bg-[#262d3d] text-[#7a8ba8] hover:text-[#ff4444] transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs font-mono text-[#4a5568] mt-3 text-right">
          {t.ent_showing(filtered.length, entities.length)}
        </p>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        message={t.delete_confirm}
        confirmLabel={t.cancel === 'Cancel' ? 'Delete' : 'Удалить'}
        cancelLabel={t.cancel}
        onConfirm={() => confirmId && deleteMutation.mutate(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
