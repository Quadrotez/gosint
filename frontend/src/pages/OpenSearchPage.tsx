import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPublishedGroups, getPublishedGroupRelationships,
  importPublishedGroup, importPublishedEntity,
} from '../api';
import { useLang } from '../i18n/LangProvider';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import { useToast } from '../context/ToastContext';
import { Globe, Lock, ChevronDown, ChevronRight, Download, UserPlus } from 'lucide-react';
import type { PublishedGroupOut, PublishedEntityOut } from '../types';

export default function OpenSearchPage() {
  const { lang } = useLang();
  const { schemas } = useEntitySchemas();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['published-groups'],
    queryFn: getPublishedGroups,
  });

  const { data: relData } = useQuery({
    queryKey: ['published-group-rels', expandedGroup],
    queryFn: () => expandedGroup ? getPublishedGroupRelationships(expandedGroup) : null,
    enabled: !!expandedGroup,
  });

  const importGroupMut = useMutation({
    mutationFn: (publishedGroupId: string) => importPublishedGroup(publishedGroupId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity-groups'] });
      toast(
        lang === 'ru'
          ? `Группа «${data.name}» импортирована`
          : `Group "${data.name}" imported`,
        'success',
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || (lang === 'ru' ? 'Ошибка импорта' : 'Import failed');
      toast(msg, 'error');
    },
  });

  const importEntityMut = useMutation({
    mutationFn: (originalEntityId: string) => importPublishedEntity(originalEntityId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['entity-groups'] });
      toast(
        lang === 'ru'
          ? `Сущность импортирована в группу «${data.name}»`
          : `Entity imported into group "${data.name}"`,
        'success',
      );
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || (lang === 'ru' ? 'Ошибка импорта' : 'Import failed');
      toast(msg, 'error');
    },
  });

  const getIcon = (type: string) => schemas.find(s => s.name === type)?.icon || '🔍';
  const getTypeLabel = (type: string) => {
    const s = schemas.find(x => x.name === type);
    return s ? (lang === 'ru' && s.label_ru ? s.label_ru : s.label_en) : type;
  };

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

  const renderEntityCard = (ent: PublishedEntityOut) => {
    if (ent.is_masked) {
      return (
        <div key={ent.id} className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--border)' }}>
            <Lock size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div>
            <div className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>***</div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>*** *** ***</div>
          </div>
        </div>
      );
    }

    const meta = (ent.metadata || {}) as Record<string, string>;
    const displayName = ent.type === 'person'
      ? [meta.last_name, meta.first_name, meta.middle_name].filter(Boolean).join(' ') || ent.value
      : ent.value;
    const hasPhoto = !!meta.photo;
    const isExpanded = expandedEntity === ent.id;
    const isImportingEntity = importEntityMut.isPending && importEntityMut.variables === ent.id;

    return (
      <div key={ent.id}
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
        {/* Entity header row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--border)]"
          onClick={() => setExpandedEntity(isExpanded ? null : ent.id)}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ background: 'var(--border)' }}>
            {hasPhoto ? (
              <img src={meta.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{getIcon(ent.type)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</div>
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{getTypeLabel(ent.type)}</div>
          </div>
          {/* Import entity button */}
          <button
            onClick={e => { e.stopPropagation(); importEntityMut.mutate(ent.id); }}
            disabled={isImportingEntity}
            title={lang === 'ru' ? 'Импортировать сущность' : 'Import entity'}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-colors"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              opacity: isImportingEntity ? 0.6 : 1,
            }}>
            <UserPlus size={11} />
            {lang === 'ru' ? 'Имп.' : 'Import'}
          </button>
          {isExpanded ? <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />}
        </div>

        {/* Expanded entity details */}
        {isExpanded && (
          <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: 'var(--border-light)' }}>
            {Object.entries(meta).filter(([k]) => k !== 'photo').map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs font-mono py-0.5">
                <span style={{ color: 'var(--text-muted)', minWidth: 90 }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
              </div>
            ))}
            {ent.notes && (
              <div className="mt-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{ent.notes}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Globe size={20} style={{ color: 'var(--accent)' }} />
          {lang === 'ru' ? 'Открытый поиск' : 'Open Search'}
        </h1>
        <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru'
            ? 'Сущности, которыми поделились другие пользователи. Импортируйте группы или отдельные сущности в своё хранилище.'
            : 'Entities shared by other users. Import groups or individual entities into your storage.'}
        </p>
      </div>

      {isLoading ? (
        <div className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Загрузка...' : 'Loading...'}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={cardStyle}>
          <Globe size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет опубликованных групп' : 'No published groups yet'}
          </p>
          <p className="text-xs font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru'
              ? 'Создайте группы сущностей и опубликуйте их'
              : 'Create entity groups and publish them to share'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group: PublishedGroupOut) => {
            const isExpanded = expandedGroup === group.group_id;
            const groupRels = isExpanded && relData ? relData.relationships : [];
            const isImportingGroup = importGroupMut.isPending && importGroupMut.variables === group.id;

            return (
              <div key={group.id} className="rounded-xl overflow-hidden" style={cardStyle}>
                {/* Group header */}
                <div className="flex items-center gap-0">
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : group.group_id)}
                    className="flex-1 flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-secondary)]"
                  >
                    <Globe size={16} style={{ color: 'var(--accent)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{group.group_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'от' : 'by'} @{group.publisher_username}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>·</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                          {group.entities.length} {lang === 'ru' ? 'сущн.' : 'entities'}
                        </span>
                      </div>
                      {group.group_description && (
                        <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{group.group_description}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                  </button>

                  {/* Import group button */}
                  <button
                    onClick={() => importGroupMut.mutate(group.id)}
                    disabled={isImportingGroup}
                    title={lang === 'ru' ? 'Импортировать всю группу' : 'Import entire group'}
                    className="flex items-center gap-1.5 px-4 py-4 font-mono text-xs transition-colors hover:bg-[var(--bg-secondary)] border-l"
                    style={{
                      color: 'var(--accent)',
                      borderColor: 'var(--border)',
                      opacity: isImportingGroup ? 0.6 : 1,
                    }}>
                    <Download size={14} />
                    {lang === 'ru' ? 'Импорт группы' : 'Import group'}
                  </button>
                </div>

                {/* Expanded group content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="pt-4 grid grid-cols-2 gap-2">
                      {group.entities.map(ent => renderEntityCard(ent))}
                    </div>

                    {/* Relationships section */}
                    {groupRels.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                          {lang === 'ru' ? 'Связи' : 'Connections'}
                        </div>
                        <div className="space-y-1.5">
                          {groupRels.map((rel: any) => {
                            const srcEnt = group.entities.find(e => e.id === rel.source_entity_id);
                            const isMasked = rel.other_entity?.is_masked;
                            return (
                              <div key={rel.id} className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded"
                                style={{ background: 'var(--bg-secondary)' }}>
                                <span style={{ color: 'var(--text-primary)' }}>
                                  {srcEnt && !srcEnt.is_masked ? (
                                    srcEnt.type === 'person'
                                      ? [((srcEnt.metadata || {}) as any).last_name, ((srcEnt.metadata || {}) as any).first_name].filter(Boolean).join(' ') || srcEnt.value
                                      : srcEnt.value
                                  ) : '***'}
                                </span>
                                <span style={{ color: 'var(--accent)' }}>— {rel.type} →</span>
                                {isMasked ? (
                                  <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                    <Lock size={10} /> ***
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-primary)' }}>{rel.other_entity?.value}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
