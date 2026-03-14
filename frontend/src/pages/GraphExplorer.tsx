import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntities, getEntityGraph, updateRelationship, getRelationshipTypeSchemas } from '../api';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import { useLang } from '../i18n/LangProvider';
import cytoscape from 'cytoscape';
import {
  Search, ZoomIn, ZoomOut, Maximize2, ChevronLeft, Sliders, X, Check, Edit2,
} from 'lucide-react';
import type { Entity } from '../types';

function personDisplayName(e: Entity): string {
  const meta = (e.metadata || {}) as Record<string, string>;
  const parts = [meta.last_name, meta.first_name].filter(Boolean);
  return parts.join(' ') || e.value;
}

interface EdgeAnnotation {
  relId: string;
  relType: string;
  notes: string;
  source: string;
  target: string;
}

export default function GraphExplorer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { getColor, getIcon, getLabel, allTypeNames, schemas } = useEntitySchemas();
  const qc = useQueryClient();

  const rootId = searchParams.get('focus') || '';
  const [depth, setDepth] = useState(2);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Edge annotation panel
  const [edgePanel, setEdgePanel] = useState<EdgeAnnotation | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesTab, setNotesTab] = useState<'write' | 'preview'>('write');

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => getEntities({ limit: 500 }),
  });

  const { data: relTypeSchemas = [] } = useQuery({
    queryKey: ['relationship-type-schemas'],
    queryFn: getRelationshipTypeSchemas,
  });

  const { data: graphData, isLoading } = useQuery({
    queryKey: ['graph', rootId, depth],
    queryFn: () => getEntityGraph(rootId, depth),
    enabled: !!rootId,
  });

  const updateRelMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => updateRelationship(id, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['graph', rootId, depth] });
      setEditingNotes(false);
    },
  });

  const filteredEntities = entities.filter(e => {
    if (!entitySearch) return true;
    const q = entitySearch.toLowerCase();
    const name = e.type === 'person' ? personDisplayName(e) : e.value;
    return name.toLowerCase().includes(q) || e.type.toLowerCase().includes(q);
  });

  // Build cytoscape — always mounted container
  useEffect(() => {
    if (!containerRef.current || !graphData) return;
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

    const isDark = !document.documentElement.classList.contains('theme-light');
    const edgeColor   = isDark ? '#2d3650' : '#c0c8e0';
    const arrowColor  = isDark ? '#3a4a6a' : '#8090b8';
    const edgeLabelColor = isDark ? '#5a6888' : '#8090b8';
    const bgPanelColor = isDark ? '#0a0c14' : '#f8f9fe';
    const nodeText    = isDark ? '#e8edf5' : '#1a1f2e';
    const selectedBorder = '#00d4ff';
    const annotatedEdge  = '#ffd700';

    const nodes = filterTypes.length > 0
      ? graphData.nodes.filter(n => filterTypes.includes(n.type))
      : graphData.nodes;
    const nodeIds = new Set(nodes.map(n => n.id));
    const edges = graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const getNodeLabel = (n: typeof graphData.nodes[0]) => {
      if (n.type === 'person') {
        const m = (n.metadata || {}) as Record<string, string>;
        const p = [m.last_name, m.first_name].filter(Boolean);
        return (p.join(' ') || n.value).slice(0, 20);
      }
      return n.value.slice(0, 20);
    };

    // Get custom icon_image from schema
    const getIconImage = (type: string): string | null => {
      const schema = schemas.find(s => s.name === type);
      return (schema as any)?.icon_image ?? null;
    };

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...nodes.map(n => {
          const photo = (n.metadata as Record<string, string> | null)?.photo ?? null;
          const iconImg = getIconImage(n.type);
          return {
            data: {
              id: n.id,
              label: getNodeLabel(n),
              color: getColor(n.type),
              isRoot: n.id === rootId,
              icon: getIcon(n.type),
              type: n.type,
              bgImage: photo || iconImg || null,
              hasPhoto: !!photo,
            },
          };
        }),
        ...edges.map(e => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.type,
            notes: (e as any).notes || '',
            hasNotes: !!((e as any).notes),
            isBidirectional: !!(relTypeSchemas as any[]).find(r => r.name === e.type && r.is_bidirectional),
          },
        })),
      ],
      style: [
        // ── All nodes: perfect circle ──────────────────────────────
        {
          selector: 'node',
          style: {
            'shape': 'ellipse',                    // circle
            'width': 52,
            'height': 52,
            'background-color': 'data(color)',
            'background-opacity': 0.15,
            'border-width': 2.5,
            'border-color': 'data(color)',
            'label': 'data(label)',
            'color': nodeText,
            'font-family': 'monospace',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-wrap': 'none',
          } as any,
        },
        // ── Nodes with photo: fill circle with image ──────────────
        {
          selector: 'node[?hasPhoto]',
          style: {
            'background-image': 'data(bgImage)',
            'background-fit': 'cover',
            'background-opacity': 1,
          } as any,
        },
        // ── Nodes with type icon image (no photo) ─────────────────
        {
          selector: 'node[bgImage][!hasPhoto]',
          style: {
            'background-image': 'data(bgImage)',
            'background-fit': 'contain',
            'background-opacity': 0.8,
          } as any,
        },
        // ── Root node ─────────────────────────────────────────────
        {
          selector: 'node[?isRoot]',
          style: {
            'border-width': 4,
            'border-color': selectedBorder,
            'background-opacity': 0.25,
            'font-weight': 'bold',
            'width': 62,
            'height': 62,
          } as any,
        },
        // ── Selected ──────────────────────────────────────────────
        {
          selector: 'node:selected',
          style: { 'border-color': selectedBorder, 'border-width': 3.5 } as any,
        },
        // ── Edges ─────────────────────────────────────────────────
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
        // ── Edge with notes: gold tint ────────────────────────────
        {
          selector: 'edge[?hasNotes]',
          style: {
            'line-color': annotatedEdge,
            'target-arrow-color': annotatedEdge,
            'color': annotatedEdge,
          } as any,
        },
        // ── Bidirectional edges ────────────────────────────────────
        {
          selector: 'edge[?isBidirectional]',
          style: {
            'source-arrow-shape': 'triangle',
            'source-arrow-color': arrowColor,
          } as any,
        },
        {
          selector: 'edge:selected',
          style: { 'line-color': selectedBorder, 'target-arrow-color': selectedBorder } as any,
        },
      ],
      layout: (() => {
        const n = nodes.length;
        // Scale layout params by node count so dense graphs don't collapse
        const repulsion  = n < 20  ? 8_000
                         : n < 50  ? 20_000
                         : n < 100 ? 45_000
                         : n < 200 ? 90_000
                         :           150_000;
        const edgeLen    = n < 20  ? 120
                         : n < 50  ? 160
                         : n < 100 ? 220
                         : n < 200 ? 300
                         :           380;
        const gravity    = n < 50  ? 0.25
                         : n < 100 ? 0.15
                         :           0.08;
        const numIter    = n < 50  ? 1000
                         : n < 100 ? 1500
                         :           2500;
        return {
          name: 'cose',
          animate: n < 60,
          animationDuration: 500,
          padding: Math.max(50, n * 2),
          nodeRepulsion: () => repulsion,
          idealEdgeLength: () => edgeLen,
          edgeElasticity: () => 0.45,
          gravity,
          numIter,
          coolingFactor: 0.97,
          minTemp: 1.0,
          randomize: n > 30,  // randomize start position for large graphs
          componentSpacing: Math.max(80, n * 3),
        };
      })() as any,
      minZoom: 0.1, maxZoom: 4,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    // Double-click node → navigate
    cyRef.current.on('dblclick', 'node', (e) => {
      setSearchParams({ focus: e.target.id() });
    });

    // Click edge → show annotation panel
    cyRef.current.on('tap', 'edge', (e) => {
      const ed = e.target.data();
      // Find the edge in graphData to get relId
      const graphEdge = graphData.edges.find(ge => ge.id === ed.id);
      if (graphEdge) {
        setEdgePanel({
          relId: graphEdge.id,
          relType: graphEdge.type,
          notes: (graphEdge as any).notes || '',
          source: graphEdge.source,
          target: graphEdge.target,
        });
        setNotesText((graphEdge as any).notes || '');
        setEditingNotes(false);
        setNotesTab('write');
      }
    });

    // Click canvas → close edge panel
    cyRef.current.on('tap', (e) => {
      if (e.target === cyRef.current) setEdgePanel(null);
    });

    cyRef.current.one('layoutstop', () => cyRef.current?.fit(undefined, 40));

    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [graphData, filterTypes, rootId, schemas]);

  const toggleTypeFilter = (type: string) => {
    setFilterTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const selectEntity = (id: string) => { setSearchParams({ focus: id }); setSidebarOpen(false); };

  const getEntityName = (id: string) => {
    const e = entities.find(en => en.id === id);
    if (!e) return id.slice(0, 8);
    return e.type === 'person' ? personDisplayName(e) : e.value;
  };

  const nodeCount = graphData?.nodes.length ?? 0;
  const edgeCount = graphData?.edges.length ?? 0;

  return (
    <div className="flex h-full relative" style={{ background: 'var(--bg-main)' }}>
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setSidebarOpen(false)} />
      )}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-3 z-20 sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <Sliders size={16} />
        </button>
      )}

      {/* Left sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        sm:translate-x-0 fixed sm:relative z-20 sm:z-auto
        w-64 h-full flex-shrink-0 flex flex-col border-r transition-transform duration-200
      `} style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        <button onClick={() => setSidebarOpen(false)}
          className="sm:hidden absolute right-2 top-2 w-7 h-7 flex items-center justify-center rounded"
          style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} />
        </button>

        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            {t.graph_root_label}
          </div>
          <div className="relative mb-3">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={entitySearch} onChange={e => setEntitySearch(e.target.value)}
              placeholder={t.graph_find_placeholder}
              className="w-full pl-8 pr-3 py-1.5 rounded text-xs font-mono outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filteredEntities.slice(0, 60).map(e => {
              const name = e.type === 'person' ? personDisplayName(e) : e.value;
              const meta = (e.metadata || {}) as Record<string, string>;
              const color = getColor(e.type);
              const isActive = rootId === e.id;
              return (
                <button key={e.id} onClick={() => selectEntity(e.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors"
                  style={{ background: isActive ? 'var(--border)' : undefined, color: isActive ? color : 'var(--text-muted)' }}>
                  {e.type === 'person' && meta.photo
                    ? <img src={meta.photo} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    : <span className="text-sm flex-shrink-0">{getIcon(e.type)}</span>}
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
          <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            {t.graph_filter_types}
          </div>
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
            <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {t.graph_stats(nodeCount, edgeCount)}
            </p>
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
              {t.graph_hint}
            </p>
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              Нажмите на связь для заметки
            </p>
          </div>
        )}
      </div>

      {/* Graph canvas — always mounted */}
      <div className="flex-1 relative min-w-0">
        {!rootId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none z-10">
            <div className="text-5xl mb-4">🔭</div>
            <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{t.graph_empty}</p>
            <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t.graph_empty_hint}</p>
          </div>
        )}
        {rootId && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--bg-main)', opacity: 0.85 }}>
            <p className="text-sm font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>{t.graph_loading}</p>
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />

        {/* Edge annotation panel */}
        {edgePanel && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-96 max-w-[90vw] rounded-xl shadow-xl z-20 overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--accent)' }}>
                  {edgePanel.relType}
                </span>
                <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                  {getEntityName(edgePanel.source)} → {getEntityName(edgePanel.target)}
                </span>
              </div>
              <button onClick={() => setEdgePanel(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            <div className="p-4">
              {editingNotes ? (
                <>
                  <div className="flex gap-2 mb-2">
                    {(['write', 'preview'] as const).map(tab => (
                      <button key={tab} onClick={() => setNotesTab(tab)}
                        className="text-xs font-mono px-2 py-1 rounded transition-colors"
                        style={{
                          background: notesTab === tab ? 'var(--accent-dim)' : 'transparent',
                          color: notesTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${notesTab === tab ? 'var(--accent)' : 'transparent'}`,
                        }}>
                        {tab === 'write' ? 'Писать' : 'Просмотр'}
                      </button>
                    ))}
                  </div>
                  {notesTab === 'write' ? (
                    <textarea value={notesText} onChange={e => setNotesText(e.target.value)}
                      rows={5} placeholder="Заметки (Markdown поддерживается)..."
                      className="w-full px-3 py-2 rounded text-xs font-mono outline-none resize-none"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                  ) : (
                    <div className="min-h-[80px] px-3 py-2 rounded text-xs"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      {notesText
                        ? <MarkdownRenderer content={notesText} />
                        : <span className="italic" style={{ color: 'var(--text-muted)' }}>Нет содержимого</span>}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateRelMut.mutate({ id: edgePanel.relId, notes: notesText })}
                      disabled={updateRelMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-mono disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#000' }}>
                      <Check size={11} /> Сохранить
                    </button>
                    <button onClick={() => { setEditingNotes(false); setNotesText(edgePanel.notes); }}
                      className="px-3 py-1.5 rounded text-xs font-mono"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  {edgePanel.notes
                    ? <MarkdownRenderer content={edgePanel.notes} />
                    : <p className="text-xs font-mono italic" style={{ color: 'var(--text-muted)' }}>Нет заметки</p>}
                  <button onClick={() => { setEditingNotes(true); setNotesText(edgePanel.notes); setNotesTab('write'); }}
                    className="flex items-center gap-1 mt-3 text-xs font-mono hover:underline"
                    style={{ color: 'var(--accent)' }}>
                    <Edit2 size={11} /> {edgePanel.notes ? 'Редактировать' : 'Добавить заметку'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
