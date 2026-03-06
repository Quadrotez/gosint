import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSearchStore } from '../../store';
import { searchEntities } from '../../api';
import { getPersonDisplayName } from '../../utils';
import { useEntitySchemas } from '../../context/EntitySchemasContext';
import { useLang } from '../../i18n/LangProvider';
import { Search, X } from 'lucide-react';
import type { Entity } from '../../types';

export default function SearchModal() {
  const { isSearchOpen, closeSearch } = useSearchStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t } = useLang();
  const [activeIdx, setActiveIdx] = useState(0);
  const { getColor, getIcon, getLabel } = useEntitySchemas();

  const { data: results = [] } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchEntities(query, 20),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setActiveIdx(0);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isSearchOpen ? closeSearch() : useSearchStore.getState().openSearch();
      }
      if (!isSearchOpen) return;
      if (e.key === 'Escape') closeSearch();
      if (e.key === 'ArrowDown') setActiveIdx(i => Math.min(i + 1, results.length - 1));
      if (e.key === 'ArrowUp') setActiveIdx(i => Math.max(i - 1, 0));
      if (e.key === 'Enter' && results[activeIdx]) {
        navigate(`/entities/${results[activeIdx].id}`);
        closeSearch();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSearchOpen, results, activeIdx]);

  useEffect(() => { setActiveIdx(0); }, [results]);

  if (!isSearchOpen) return null;

  const people = results.filter(e => e.type === 'person');
  const others = results.filter(e => e.type !== 'person');

  const renderEntity = (e: Entity, idx: number) => {
    const displayName = e.type === 'person' ? getPersonDisplayName(e) : e.value;
    const meta = (e.metadata || {}) as Record<string, string>;
    const color = getColor(e.type);
    return (
      <button
        key={e.id}
        onClick={() => { navigate(`/entities/${e.id}`); closeSearch(); }}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
          idx === activeIdx ? 'bg-[#1e2330]' : 'hover:bg-[#181c24]'
        }`}
      >
        {e.type === 'person' && meta.photo
          ? <img src={meta.photo} alt="" className="w-7 h-7 rounded-full object-cover border border-[#262d3d] flex-shrink-0" />
          : (
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
              {getIcon(e.type)}
            </span>
          )
        }
        <div className="flex-1 min-w-0">
          <div className="text-sm font-mono text-[#e8edf5] truncate">{displayName}</div>
          <div className="text-[10px] font-mono" style={{ color }}>{getLabel(e.type)}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={closeSearch}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#111318] border border-[#262d3d] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2330]">
          <Search size={16} className="text-[#4a5568] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.search_placeholder}
            className="flex-1 bg-transparent font-mono text-sm text-[#e8edf5] placeholder-[#4a5568] outline-none"
          />
          <button onClick={closeSearch} className="text-[#4a5568] hover:text-[#7a8ba8]">
            <X size={16} />
          </button>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {query.length < 2 ? (
            <p className="text-xs font-mono text-[#4a5568] text-center py-6">{t.search_hint}</p>
          ) : results.length === 0 ? (
            <p className="text-xs font-mono text-[#4a5568] text-center py-6">{t.search_empty(query)}</p>
          ) : (
            <>
              {people.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-[#4a5568] uppercase tracking-widest">{t.search_section_people}</div>
                  {people.map((e, i) => renderEntity(e, i))}
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[10px] font-mono text-[#4a5568] uppercase tracking-widest">{t.search_section_other}</div>
                  {others.map((e, i) => renderEntity(e, people.length + i))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-2 border-t border-[#1e2330] flex gap-4">
          <span className="text-[10px] font-mono text-[#4a5568]">↑↓ navigate</span>
          <span className="text-[10px] font-mono text-[#4a5568]">Enter {t.search_shortcut}</span>
          <span className="text-[10px] font-mono text-[#4a5568]">Esc {t.search_close}</span>
        </div>
      </div>
    </div>
  );
}
