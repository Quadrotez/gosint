import { useEntitySchemas } from '../../context/EntitySchemasContext';

interface Props {
  type: string;
  size?: 'sm' | 'md';
}

export default function EntityTypeBadge({ type, size = 'md' }: Props) {
  const { getColor, getIcon, getLabel } = useEntitySchemas();
  const color = getColor(type);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono rounded ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      }`}
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      <span>{getIcon(type)}</span>
      <span>{getLabel(type)}</span>
    </span>
  );
}
