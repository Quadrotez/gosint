import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntity, getEntityRelationships, updateEntity } from '../api';
import { useLang } from '../i18n/LangProvider';
import { useSettings } from '../context/SettingsContext';
import { useEntitySchemas } from '../context/EntitySchemasContext';
import EntityTypeBadge from '../components/ui/EntityTypeBadge';
import MarkdownRenderer from '../components/ui/MarkdownRenderer';
import {
  ArrowLeft, Plus, Trash2, Edit2, Check, X, RotateCcw,
  User, StickyNote, Link2, Info
} from 'lucide-react';

interface CardPos { x: number; y: number }
interface NoteCard { id: string; content: string; pos: CardPos; color: string }

// Note colors: set of 5 palette entries that work in both dark and light themes via CSS vars
// They're applied as backgroundColor, so we need actual values — use semi-transparent tints
const NOTE_COLORS = [
  'var(--bg-secondary)',
  'color-mix(in srgb, #22c55e 12%, var(--bg-secondary))',
  'color-mix(in srgb, #6366f1 12%, var(--bg-secondary))',
  'color-mix(in srgb, #ef4444 12%, var(--bg-secondary))',
  'color-mix(in srgb, #f59e0b 12%, var(--bg-secondary))',
];
const NOTE_COLOR_LABELS = ['Default', 'Green', 'Blue', 'Red', 'Yellow'];

function useDrag(onMove: (dx: number, dy: number) => void) {
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    onMove(dx, dy);
  }, [onMove]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

export default function EntityBoardPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { formatDate } = useSettings();
  const { getColor, getIcon } = useEntitySchemas();
  const queryClient = useQueryClient();

  const { data: entity } = useQuery({
    queryKey: ['entity', id],
    queryFn: () => getEntity(id!),
    enabled: !!id,
  });
  const { data: relationships = [] } = useQuery({
    queryKey: ['entity-rels', id],
    queryFn: () => getEntityRelationships(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { metadata?: Record<string, unknown> }) => updateEntity(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entity', id] }),
  });

  const meta = (entity?.metadata || {}) as Record<string, string>;
  const isPerson = entity?.type === 'person';
  const color = entity ? getColor(entity.type) : '#00d4ff';

  const displayName = isPerson
    ? [meta.last_name, meta.first_name, meta.middle_name].filter(Boolean).join(' ') || entity?.value || ''
    : entity?.value || '';

  // Board state: card positions
  const STORAGE_KEY = `board_${id}`;
  const [cardPositions, setCardPositions] = useState<Record<string, CardPos>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  });

  // Notes state
  const [notes, setNotes] = useState<NoteCard[]>(() => {
    try {
      const saved = meta._board_notes;
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  // Sync notes from entity metadata when loaded
  useEffect(() => {
    if (entity) {
      const m = (entity.metadata || {}) as Record<string, string>;
      try {
        const parsed = m._board_notes ? JSON.parse(m._board_notes) : [];
        setNotes(parsed);
      } catch { setNotes([]); }
    }
  }, [entity]);

  const savePositions = (pos: Record<string, CardPos>) => {
    setCardPositions(pos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  };

  const saveNotes = (newNotes: NoteCard[]) => {
    setNotes(newNotes);
    const newMeta = { ...meta, _board_notes: JSON.stringify(newNotes) };
    updateMutation.mutate({ metadata: newMeta });
  };

  const getPos = (key: string, defaultPos: CardPos): CardPos =>
    cardPositions[key] || defaultPos;

  const moveCard = (key: string, dx: number, dy: number) => {
    const curr = cardPositions[key] || { x: 0, y: 0 };
    savePositions({ ...cardPositions, [key]: { x: curr.x + dx, y: curr.y + dy } });
  };

  const resetLayout = () => {
    savePositions({});
    localStorage.removeItem(STORAGE_KEY);
  };

  // Note editing
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const addNote = () => {
    const newNote: NoteCard = {
      id: Date.now().toString(),
      content: '',
      pos: { x: Math.random() * 200 + 50, y: Math.random() * 150 + 50 },
      color: NOTE_COLORS[0],
    };
    const newNotes = [...notes, newNote];
    setNotes(newNotes);
    setEditingNote(newNote.id);
    setNoteText('');
    saveNotes(newNotes);
  };

  const saveNote = (noteId: string) => {
    const newNotes = notes.map(n => n.id === noteId ? { ...n, content: noteText } : n);
    setEditingNote(null);
    saveNotes(newNotes);
  };

  const deleteNote = (noteId: string) => {
    saveNotes(notes.filter(n => n.id !== noteId));
  };

  if (!entity) {
    return <div className="p-8 text-[var(--text-muted)] font-mono text-sm">{t.loading}</div>;
  }

  // Board cards definition
  const CARDS = [
    { key: 'info', defaultPos: { x: 40, y: 40 } },
    { key: 'rels', defaultPos: { x: 460, y: 40 } },
    { key: 'fields', defaultPos: { x: 40, y: 340 } },
  ];

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-main)]">
      {/* Top bar */}
      <div className="flex-shrink-0 h-12 bg-[var(--bg-card)] border-b border-[var(--border)] flex items-center px-4 gap-4 z-20">
        <Link
          to={`/entities/${id}`}
          className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={13} /> {t.board_back}
        </Link>
        <div className="w-px h-4 bg-[var(--border)]" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono" style={{ color }}>{displayName}</span>
          <EntityTypeBadge type={entity.type} size="sm" />
        </div>
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-[var(--text-muted)]">{t.board_hint}</span>
        <button
          onClick={addNote}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-[#0a0c0f] font-mono text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={11} /> {t.board_add_note}
        </button>
        <button
          onClick={resetLayout}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-light)] text-[var(--text-muted)] font-mono text-xs rounded-lg hover:border-[var(--border-hover)] transition-colors"
        >
          <RotateCcw size={11} /> {t.board_reset}
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Grid background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Entity info card */}
        <DraggableCard
          pos={getPos('info', CARDS[0].defaultPos)}
          onMove={(dx, dy) => moveCard('info', dx, dy)}
          className="w-72"
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border)]">
            <Info size={12} className="text-[var(--accent)]" />
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
              {lang === 'ru' ? 'Информация' : 'Info'}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            {isPerson && meta.photo ? (
              <img src={meta.photo} className="w-12 h-12 rounded-xl object-cover border border-[var(--border)]" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
                <span className="text-xl">{getIcon(entity.type)}</span>
              </div>
            )}
            <div>
              <div className="font-mono font-semibold text-sm" style={{ color }}>{displayName}</div>
              <EntityTypeBadge type={entity.type} size="sm" />
            </div>
          </div>

          {isPerson && (
            <div className="space-y-1.5">
              {[
                { label: lang === 'ru' ? 'Фамилия' : 'Last Name', val: meta.last_name },
                { label: lang === 'ru' ? 'Имя' : 'First Name', val: meta.first_name },
                { label: lang === 'ru' ? 'Отчество' : 'Patronymic', val: meta.middle_name },
                { label: lang === 'ru' ? 'Дата рождения' : 'Date of Birth', val: meta.dob },
              ].filter(f => f.val).map(({ label, val }) => (
                <div key={label} className="flex gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] w-24 flex-shrink-0">{label}</span>
                  <span className="text-[10px] font-mono text-[var(--text-primary)]">{val}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-[var(--border)]">
            <div className="text-[10px] font-mono text-[var(--text-muted)]">
              {lang === 'ru' ? 'Добавлено' : 'Added'}: {formatDate(entity.created_at)}
            </div>
          </div>
        </DraggableCard>

        {/* Relationships card */}
        <DraggableCard
          pos={getPos('rels', CARDS[1].defaultPos)}
          onMove={(dx, dy) => moveCard('rels', dx, dy)}
          className="w-80"
        >
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border)]">
            <Link2 size={12} className="text-[var(--accent)]" />
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
              {t.ep_relationships} ({relationships.length})
            </span>
          </div>

          {relationships.length === 0 ? (
            <div className="text-[10px] font-mono text-[var(--text-muted)] py-2">{t.ep_rel_empty}</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {relationships.map(rel => {
                const other = rel.source_entity_id === id ? rel.target_entity : rel.source_entity;
                const direction = rel.source_entity_id === id ? '→' : '←';
                if (!other) return null;
                const otherMeta = (other.metadata || {}) as Record<string, string>;
                const otherName = other.type === 'person'
                  ? [otherMeta.last_name, otherMeta.first_name].filter(Boolean).join(' ') || other.value
                  : other.value;
                const otherColor = getColor(other.type);
                return (
                  <Link
                    key={rel.id}
                    to={`/entities/${other.id}/board`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group"
                  >
                    <span className="text-[var(--text-muted)] font-mono text-xs w-3">{direction}</span>
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                      {other.type === 'person' && otherMeta.photo ? (
                        <img src={otherMeta.photo} className="w-full h-full rounded-lg object-cover" alt="" />
                      ) : (
                        <span className="text-xs">{getIcon(other.type)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate" style={{ color: otherColor }}>{otherName}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">{rel.type}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </DraggableCard>

        {/* Extra fields card (non-structural metadata) */}
        {(() => {
          const structural = new Set(['first_name', 'last_name', 'middle_name', 'dob', 'photo', '_board_notes', 'notes']);
          const extras = Object.entries(meta).filter(([k]) => !structural.has(k));
          if (extras.length === 0) return null;
          return (
            <DraggableCard
              pos={getPos('fields', CARDS[2].defaultPos)}
              onMove={(dx, dy) => moveCard('fields', dx, dy)}
              className="w-72"
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--border)]">
                <Info size={12} className="text-[var(--accent)]" />
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                  {lang === 'ru' ? 'Поля' : 'Fields'}
                </span>
              </div>
              <div className="space-y-1.5">
                {extras.map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] w-28 flex-shrink-0">{k}</span>
                    <span className="text-[10px] font-mono text-[var(--text-primary)] break-all">{String(v)}</span>
                  </div>
                ))}
              </div>
            </DraggableCard>
          );
        })()}

        {/* Note cards */}
        {notes.map((note) => (
          <NoteCardComponent
            key={note.id}
            note={note}
            editing={editingNote === note.id}
            noteText={editingNote === note.id ? noteText : note.content}
            onStartEdit={() => { setEditingNote(note.id); setNoteText(note.content); }}
            onChangeText={setNoteText}
            onSave={() => saveNote(note.id)}
            onCancel={() => setEditingNote(null)}
            onDelete={() => deleteNote(note.id)}
            onMove={(dx, dy) => {
              const newNotes = notes.map(n =>
                n.id === note.id ? { ...n, pos: { x: n.pos.x + dx, y: n.pos.y + dy } } : n
              );
              setNotes(newNotes);
              saveNotes(newNotes);
            }}
            placeholder={t.board_note_placeholder}
            deleteLabel={t.board_delete_note}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  pos, onMove, className = '', children
}: {
  pos: CardPos;
  onMove: (dx: number, dy: number) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const drag = useDrag(onMove);

  return (
    <div
      className={`absolute bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-lg cursor-grab active:cursor-grabbing select-none ${className}`}
      style={{ left: pos.x, top: pos.y, zIndex: 10 }}
      {...drag}
    >
      {children}
    </div>
  );
}

function NoteCardComponent({
  note, editing, noteText, onStartEdit, onChangeText,
  onSave, onCancel, onDelete, onMove, placeholder, deleteLabel
}: {
  note: NoteCard;
  editing: boolean;
  noteText: string;
  onStartEdit: () => void;
  onChangeText: (t: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onMove: (dx: number, dy: number) => void;
  placeholder: string;
  deleteLabel: string;
}) {
  const drag = useDrag(onMove);

  return (
    <div
      className="absolute w-64 rounded-xl border shadow-lg select-none"
      style={{ left: note.pos.x, top: note.pos.y, backgroundColor: note.color, borderColor: 'var(--border)', zIndex: 15 }}
    >
      {/* Header drag bar */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing rounded-t-xl"
        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        {...drag}
      >
        <div className="flex items-center gap-1.5">
          <StickyNote size={11} className="text-[var(--accent)]" />
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest">Note</span>
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={onStartEdit}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Edit2 size={10} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-[var(--text-muted)] hover:text-[#ff4444] transition-colors"
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        {editing ? (
          <>
            <textarea
              autoFocus
              value={noteText}
              onChange={e => onChangeText(e.target.value)}
              placeholder={placeholder}
              className="w-full h-32 bg-transparent font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={onSave}
                className="flex items-center gap-1 px-2 py-1 bg-[var(--accent)] text-[#0a0c0f] font-mono text-[10px] rounded font-semibold"
              >
                <Check size={9} /> Save
              </button>
              <button
                onClick={onCancel}
                className="flex items-center gap-1 px-2 py-1 border border-[var(--border-light)] text-[var(--text-muted)] font-mono text-[10px] rounded"
              >
                <X size={9} /> Cancel
              </button>
            </div>
          </>
        ) : (
          note.content ? (
            <div className="font-mono text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {note.content}
            </div>
          ) : (
            <div
              className="font-mono text-[10px] text-[var(--text-muted)] italic cursor-pointer py-2"
              onClick={onStartEdit}
            >
              {placeholder}
            </div>
          )
        )}
      </div>
    </div>
  );
}
