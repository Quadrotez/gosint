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

    if (cyRef.current) cyRef.current.destroy();

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: [
        ...data.nodes.map(n => ({
          data: {
            id: n.id,
            label: n.value.length > 15 ? n.value.slice(0, 15) + '…' : n.value,
            color: getEntityColor(n.type, schemas),
            isRoot: n.id === entityId,
          },
        })),
        ...data.edges.map(e => ({
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
            'font-size': '9px',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'width': 24,
            'height': 24,
            'border-width': 0,
          },
        },
        {
          selector: 'node[?isRoot]',
          style: {
            'width': 32,
            'height': 32,
            'border-width': 2,
            'border-color': '#ffffff40',
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
      layout: { name: 'cose', animate: false, padding: 20 },
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false,
    });

    return () => { cyRef.current?.destroy(); cyRef.current = null; };
  }, [data, entityId, schemas]);

  return <div ref={containerRef} className="w-full h-full bg-[#0a0c0f]" />;
}
