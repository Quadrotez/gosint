import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEntities, getEntityGraph } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useLang } from '../i18n/LangProvider';
import cytoscape from 'cytoscape';
import { Search, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { Entity } from '../types';

function personDisplayName(e: Entity): string {
  const meta = (e.metadata || {}) as Record<string, string>;
  const parts = [meta.last_name, meta.first_name].filter(Boolean);
  return parts.join(' ') || e.value;
}

export default function GraphExplorer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { getColor, getIcon, getLabel, allTypeNames, schemas } = useEntitySchemas();

  const [rootId, setRootId] = useState<string>(searchParams.get('focus') || '');
  const [depth, setDepth] = useState(2);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState('');

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 500 }),
  });

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['graph', rootId, depth],
    queryFn: () => getEntityGraph(rootId, depth),
    enabled: !!rootId,
  });

  const filteredEntities = entities.filter(e => {
    if (!entitySearch) return true;
    const q = entitySearch.toLowerCase();
    const name = e.type === 'person' ? personDisplayName(e) : e.value;
    return name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    if (cyRef.current) cyRef.current.destroy();

    const nodes = filterTypes.length > 0
      ? graphData.nodes.filter(n => filterTypes.includes(n.type))
      : graphData.nodes;

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => ({
          data: {
            id: n.id,
            label: (n.type === 'person'
              ? (() => { const m = (n.metadata || {}) as Record<string,string>; const p = [m.last_name, m.first_name].filter(Boolean); return p.join(' ') || n.value; })()
              : n.value).slice(0, 20),
            color: getColor(n.type),
            isRoot: n.id === rootId,
          },
        })),
        ...edges.map(e => ({
          data: { id: e.id, source: e.source, target: e.target, label: e.type },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#e8edf5',
            'font-family': 'monospace',
            'font-size': '10px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 28,
            'height': 28,
          },
        },
        {
          selector: 'node[?isRoot]',
          style: { 'width': 40, 'height': 40, 'border-width': 3, 'border-color': '#00d4ff' },
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#262d3d',
            'target-arrow-color': '#3a4460',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#4a5568',
            'font-family': 'monospace',
            'text-background-color': '#0a0c0f',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 2, 'border-color': '#00d4ff' },
        },
      ],
      layout: {
        name: nodes.length > 20 ? 'cose' : 'cose',
        animate: false,
        padding: 30,
      },
    });

    cyRef.current.on('dblclick', 'node', (e) => {
      setRootId(e.target.id());
    });

    cyRef.current.on('tap', 'node', (e) => {
      // single tap — no action
    });

    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [graphData, filterTypes, rootId, schemas]);

  const toggleTypeFilter = (type: string) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const nodeCount = graphData?.nodes.length ?? 0;
  const edgeCount = graphData?.edges.length ?? 0;

  return (
    <div className="flex h-full bg-[#0a0c0f]">
      {/* Left panel */}
      <div className="w-64 flex-shrink-0 bg-[#111318] border-r border-[#1e2330] flex flex-col">
        <div className="p-4 border-b border-[#1e2330]">
          <div className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-2">{t.graph_root_label}</div>
          <div className="relative mb-3">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a5568]" />
            <input
              value={entitySearch}
              onChange={e => setEntitySearch(e.target.value)}
              placeholder={t.graph_find_placeholder}
              className="w-full pl-8 pr-3 py-1.5 bg-[#181c24] border border-[#262d3d] rounded text-xs font-mono text-[#e8edf5] placeholder-[#4a5568] outline-none focus:border-[#3a4460]"
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredEntities.slice(0, 50).map(e => {
              const name = e.type === 'person' ? personDisplayName(e) : e.value;
              const meta = (e.metadata || {}) as Record<string, string>;
              const color = getColor(e.type);
              return (
                <button
                  key={e.id}
                  onClick={() => setRootId(e.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                    rootId === e.id ? 'bg-[#1e2330]' : 'hover:bg-[#181c24]'
                  }`}
                >
                  {e.type === 'person' && meta.photo
                    ? <img src={meta.photo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    : <span className="text-sm flex-shrink-0">{getIcon(e.type)}</span>
                  }
                  <span className="text-xs font-mono truncate" style={{ color: rootId === e.id ? color : '#7a8ba8' }}>{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Depth */}
        <div className="p-4 border-b border-[#1e2330]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest">{t.graph_depth}</span>
            <span className="text-sm font-mono text-[#00d4ff]">{depth}</span>
          </div>
          <input type="range" min={1} max={5} value={depth} onChange={e => setDepth(Number(e.target.value))}
            className="w-full accent-[#00d4ff]" />
        </div>

        {/* Type filter */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-mono text-[#7a8ba8] uppercase tracking-widest mb-3">{t.graph_filter_types}</div>
          <div className="space-y-1">
            {allTypeNames.map(type => {
              const active = filterTypes.includes(type);
              const color = getColor(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleTypeFilter(type)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all ${active ? 'opacity-30' : ''}`}
                >
                  <span className="text-sm">{getIcon(type)}</span>
                  <span className="text-xs font-mono flex-1 text-left" style={{ color }}>{getLabel(type)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {graphData && (
          <div className="p-4 border-t border-[#1e2330]">
            <p className="text-[10px] font-mono text-[#4a5568]">{t.graph_stats(nodeCount, edgeCount)}</p>
            <p className="text-[10px] font-mono text-[#4a5568] mt-1">{t.graph_hint}</p>
          </div>
        )}
      </div>

      {/* Graph canvas */}
      <div className="flex-1 relative">
        {!rootId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">🔭</div>
            <p className="text-sm font-mono text-[#7a8ba8]">{t.graph_empty}</p>
            <p className="text-xs font-mono text-[#4a5568] mt-1">{t.graph_empty_hint}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm font-mono text-[#4a5568] animate-pulse">{t.graph_loading}</p>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="w-full h-full" />
            {/* Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              {[
                { icon: <ZoomIn size={14} />, action: () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2) },
                { icon: <ZoomOut size={14} />, action: () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8) },
                { icon: <Maximize2 size={14} />, action: () => cyRef.current?.fit(undefined, 30) },
              ].map(({ icon, action }, i) => (
                <button key={i} onClick={action}
                  className="w-8 h-8 bg-[#111318] border border-[#262d3d] rounded flex items-center justify-center text-[#7a8ba8] hover:text-[#e8edf5] hover:border-[#3a4460] transition-colors">
                  {icon}
                </button>
              ))}
            </div>
            {/* Open entity link */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => navigate(`/entities/${rootId}`)}
                className="text-xs font-mono text-[#00d4ff] hover:underline bg-[#111318] border border-[#262d3d] px-3 py-1.5 rounded"
              >
                {t.graph_open}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
