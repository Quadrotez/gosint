import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEntityGraph } from '../../api';
import { getEntityColor } from '../../utils';
import { useEntitySchemas } from '../../context/EntitySchemasContext';
import cytoscape from 'cytoscape';

interface Props {
  entityId: string;
  depth?: number;
}

export default function MiniGraph({ entityId, depth = 2 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { schemas } = useEntitySchemas();

  const { data } = useQuery({
    queryKey: ['graph', entityId, depth],
    queryFn: () => getEntityGraph(entityId, depth),
    enabled: !!entityId,
  });

  useEffect(() => {
    if (!containerRef.current || !data) return;

    cyRef.current?.destroy();
    cyRef.current = null;

    // Guard: collect valid node ids then filter edges so Cytoscape never gets
    // an edge referencing a node that isn't in the dataset.
    const nodeIds = new Set(data.nodes.map(n => n.id));
    const safeEdges = data.edges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target,
    );

    const elements: cytoscape.ElementDefinition[] = [
      ...data.nodes.map(n => {
        const photo = (n.metadata as Record<string, string> | null)?.photo ?? null;
        return {
          data: {
            id: n.id,
            label: n.value.length > 14 ? n.value.slice(0, 14) + '…' : n.value,
            color: getEntityColor(n.type, schemas),
            isRoot: n.id === entityId,
            photo,
          },
        };
      }),
      ...safeEdges.map(e => ({
        data: { id: e.id, source: e.source, target: e.target, label: e.type },
      })),
    ];

    const nodesWithPhoto = data.nodes
      .filter(n => (n.metadata as Record<string, string> | null)?.photo)
      .map(n => n.id);

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#e8edf5',
            'font-family': 'monospace',
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'width': 28,
            'height': 28,
            'border-width': 0,
          },
        },
        // Nodes with photos: show the photo as background image
        ...(nodesWithPhoto.length > 0 ? [{
          selector: nodesWithPhoto.map(id => `node[id="${id}"]`).join(', '),
          style: {
            'background-image': 'data(photo)',
            'background-fit': 'cover' as const,
            'border-width': 2,
            'border-color': '#60a5fa',
          },
        }] : []),
        {
          selector: 'node[?isRoot]',
          style: {
            'width': 36,
            'height': 36,
            'border-width': 2,
            'border-color': '#4a90e2',  // use solid hex, not rgba
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#262d3d',
            'target-arrow-color': '#262d3d',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '7px',
            'color': '#4a5568',
            'font-family': 'monospace',
            'text-background-color': '#0a0c0f',
            'text-background-opacity': 0.8,
            'text-background-padding': '2px',
          },
        },
      ],
      layout: (() => {
        const n = (elements.filter((e: any) => !e.data.source)).length;
        const repulsion = n < 15 ? 6_000 : n < 40 ? 18_000 : 40_000;
        const edgeLen   = n < 15 ? 100  : n < 40 ? 150   : 200;
        return {
          name: 'cose', animate: false, padding: 20,
          nodeRepulsion: () => repulsion,
          idealEdgeLength: () => edgeLen,
          gravity: n < 20 ? 0.3 : 0.15,
          numIter: n < 30 ? 800 : 1400,
          componentSpacing: Math.max(60, n * 4),
        };
      })() as cytoscape.LayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [data, entityId, schemas]);

  return <div ref={containerRef} className="w-full h-full bg-[#0a0c0f]" />;
}
