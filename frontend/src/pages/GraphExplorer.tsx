import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getEntities, getEntityGraph } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import { useLang } from '../i18n/LangProvider';
import cytoscape from 'cytoscape';
import { Search, ZoomIn, ZoomOut, Maximize2, ChevronLeft, Sliders } from 'lucide-react';
import type { Entity } from '../types';

function personDisplayName(e: Entity): string {
  const meta = (e.metadata || {}) as Record<string, string>;
  const parts = [meta.last_name, meta.first_name].filter(Boolean);
  return parts.join(' ') || e.value;
}

export default function GraphExplorer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { getColor, getIcon, getLabel, allTypeNames, schemas } = useEntitySchemas();

  // BUG FIX: rootId is derived from searchParams on every render, not stored separately.
  // This ensures navigation between entities (via URL) always triggers a fresh graph render.
  const rootId = searchParams.get('focus') || '';
  const [depth, setDepth] = useState(2);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  // Cytoscape setup — re-runs when graphData, filters, or schemas change.
  // The container div is ALWAYS mounted so containerRef is always valid.
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Destroy previous instance before creating new one
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }

    const isDark = !document.documentElement.classList.contains('theme-light');
    const nodeBg = isDark ? '#1a2035' : '#f0f4ff';
    const nodeText = isDark ? '#e8edf5' : '#1a1f2e';
    const edgeColor = isDark ? '#2d3650' : '#c0c8e0';
    const arrowColor = isDark ? '#3a4a6a' : '#8090b8';
    const edgeLabelColor = isDark ? '#5a6888' : '#8090b8';
    const bgPanelColor = isDark ? '#0a0c14' : '#f8f9fe';
    const selectedBorder = '#00d4ff';

    const nodes = filterTypes.length > 0
      ? graphData.nodes.filter(n => filterTypes.includes(n.type))
      : graphData.nodes;
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const getNodeLabel = (n: typeof graphData.nodes[0]) => {
      if (n.type === 'person') {
        const m = (n.metadata || {}) as Record<string, string>;
        const p = [m.last_name, m.first_name].filter(Boolean);
        return (p.join(' ') || n.value).slice(0, 24);
      }
      return n.value.slice(0, 24);
    };

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => ({
          data: {
            id: n.id,
            label: getNodeLabel(n),
            color: getColor(n.type),
            isRoot: n.id === rootId,
            icon: getIcon(n.type),
            type: n.type,
            photo: (n.metadata as Record<string, string> | null)?.photo ?? null,
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
            'shape': 'round-rectangle',
            'background-color': nodeBg,
            'border-width': 2,
            'border-color': 'data(color)',
            'label': 'data(label)',
            'color': nodeText,
            'font-family': 'monospace',
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'label',
            'height': 32,
            'padding': '8px',
            'text-wrap': 'none',
          } as any,
        },
        ...(nodes.some(n => (n.metadata as Record<string, string> | null)?.photo)
          ? [{
              selector: nodes
                .filter(n => (n.metadata as Record<string, string> | null)?.photo)
                .map(n => `node[id="${n.id}"]`).join(', '),
              style: {
                'background-image': 'data(photo)',
                'background-fit': 'cover' as const,
              },
            }]
          : []),
        {
          selector: 'node[?isRoot]',
          style: {
            'border-width': 3,
            'border-color': selectedBorder,
            'background-color': isDark ? '#0f1a30' : '#e8f0ff',
            'font-weight': 'bold',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': edgeColor,
            'target-arrow-color': arrowColor,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '9px',
            'color': edgeLabelColor,
            'font-family': 'monospace',
            'text-background-color': bgPanelColor,
            'text-background-opacity': 0.85,
            'text-background-padding': '3px',
            'text-background-shape': 'round-rectangle',
          } as any,
        },
        {
          selector: 'node:selected',
          style: { 'border-color': selectedBorder, 'border-width': 3 } as any,
        },
        {
          selector: 'node:active',
          style: { 'overlay-opacity': 0.1, 'overlay-color': selectedBorder } as any,
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': selectedBorder, 'target-arrow-color': selectedBorder } as any,
        },
      ],
      layout: {
        name: 'cose',
        animate: nodes.length < 30,
        animationDuration: 400,
        padding: 40,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 0.45,
        gravity: 0.25,
        numIter: 1000,
        coolingFactor: 0.99,
        minTemp: 1.0,
      } as any,
      minZoom: 0.1,
      maxZoom: 4,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    cyRef.current.on('dblclick', 'node', (e) => {
      setSearchParams({ focus: e.target.id() });
    });

    cyRef.current.one('layoutstop', () => {
      cyRef.current?.fit(undefined, 40);
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [graphData, filterTypes, rootId, schemas]);

  const toggleTypeFilter = (type: string) => {
    setFilterTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const selectEntity = (id: string) => {
    setSearchParams({ focus: id });
    setSidebarOpen(false);
  };

  const nodeCount = graphData?.nodes.length ?? 0;
  const edgeCount = graphData?.edges.length ?? 0;

  return (
    <div className="flex h-full relative" style={{ background: 'var(--bg-main)' }}>
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setSidebarOpen(false)} />
      )}

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-3 z-20 sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <Sliders size={16} />
        </button>
      )}

      {/* Left panel */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        sm:translate-x-0
        fixed sm:relative z-20 sm:z-auto
        w-64 h-full flex-shrink-0 flex flex-col border-r transition-transform duration-200
      `} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <button onClick={() => setSidebarOpen(false)}
          className="sm:hidden absolute right-2 top-2 w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ChevronLeft size={16} />
        </button>

        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{t.graph_root_label}</div>
          <div className="relative mb-3">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={entitySearch}
              onChange={e => setEntitySearch(e.target.value)}
              placeholder={t.graph_find_placeholder}
              className="w-full pl-8 pr-3 py-1.5 rounded text-xs font-mono outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filteredEntities.slice(0, 60).map(e => {
              const name = e.type === 'person' ? personDisplayName(e) : e.value;
              const meta = (e.metadata || {}) as Record<string, string>;
              const color = getColor(e.type);
              const isActive = rootId === e.id;
              return (
                <button
                  key={e.id}
                  onClick={() => selectEntity(e.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                  style={{
                    background: isActive ? 'var(--border)' : undefined,
                    color: isActive ? color : 'var(--text-muted)',
                  }}
                >
                  {e.type === 'person' && meta.photo
                    ? <img src={meta.photo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    : <span className="text-sm flex-shrink-0">{getIcon(e.type)}</span>
                  }
                  <span className="text-xs font-mono truncate">{name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{t.graph_depth}</span>
            <span className="text-sm font-mono" style={{ color: 'var(--accent)' }}>{depth}</span>
          </div>
          <input type="range" min={1} max={5} value={depth} onChange={e => setDepth(Number(e.target.value))}
            className="w-full" style={{ accentColor: 'var(--accent)' } as any} />
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>{t.graph_filter_types}</div>
          <div className="space-y-1">
            {allTypeNames.map(type => {
              const hidden = filterTypes.includes(type);
              const color = getColor(type);
              return (
                <button key={type} onClick={() => toggleTypeFilter(type)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                  style={{ opacity: hidden ? 0.3 : 1 }}>
                  <span className="text-sm">{getIcon(type)}</span>
                  <span className="text-xs font-mono flex-1 text-left" style={{ color }}>{getLabel(type)}</span>
                  {hidden && <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>hidden</span>}
                </button>
              );
            })}
          </div>
        </div>

        {graphData && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{t.graph_stats(nodeCount, edgeCount)}</p>
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>{t.graph_hint}</p>
          </div>
        )}
      </div>

      {/* Graph canvas — always mounted so containerRef is always valid */}
      <div className="flex-1 relative min-w-0">
        {/* Empty state overlay */}
        {!rootId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none z-10">
            <div className="text-5xl mb-4">🔭</div>
            <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{t.graph_empty}</p>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t.graph_empty_hint}</p>
          </div>
        )}

        {/* Loading overlay — does NOT unmount the canvas div */}
        {rootId && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg-main)', opacity: 0.85 }}>
            <p className="text-sm font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>{t.graph_loading}</p>
          </div>
        )}

        {/* Canvas always in DOM — eliminates containerRef = null race condition */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Controls */}
        {rootId && !isLoading && (
          <>
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              {[
                { icon: <ZoomIn size={14} />, action: () => cyRef.current?.zoom({ level: (cyRef.current?.zoom() ?? 1) * 1.25, renderedPosition: { x: (containerRef.current?.offsetWidth ?? 400) / 2, y: (containerRef.current?.offsetHeight ?? 300) / 2 } }) },
                { icon: <ZoomOut size={14} />, action: () => cyRef.current?.zoom({ level: (cyRef.current?.zoom() ?? 1) * 0.8, renderedPosition: { x: (containerRef.current?.offsetWidth ?? 400) / 2, y: (containerRef.current?.offsetHeight ?? 300) / 2 } }) },
                { icon: <Maximize2 size={14} />, action: () => cyRef.current?.fit(undefined, 40) },
              ].map(({ icon, action }, i) => (
                <button key={i} onClick={action}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  {icon}
                </button>
              ))}
            </div>
            <div className="absolute top-3 right-3">
              <button onClick={() => navigate(`/entities/${rootId}`)}
                className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--accent)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {t.graph_open}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
