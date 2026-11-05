import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { groupByDue } from '../lib/grouping';
import type { Note, Tag } from '../types';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';
import { CloseIcon, PinIcon, SearchIcon } from './icons';

type View = 'pending' | 'done';

interface NotePanelProps {
  notes: Note[];
  tags: Tag[];
  selectedId: string | null;
  pinned: boolean;
  error: string | null;
  quickAddRef: Ref<HTMLInputElement>;
  onOpen: (id: string) => void;
  onToggleDone: (note: Note) => void;
  onQuickAdd: (title: string) => Promise<void>;
  onTogglePinned: () => void;
  onDismissError: () => void;
}

/** Tiempo que una tarea recién completada sigue visible, tachada, antes de irse a "Hechas". */
const COMPLETE_GRACE_MS = 1200;

const todayFormat = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

/** Panel lateral: resumen del día, captura rápida, filtros y tareas agrupadas por fecha. */
export function NotePanel(props: NotePanelProps) {
  const { notes, tags, selectedId, pinned, error } = props;
  const [view, setView] = useState<View>('pending');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, number>());

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /** Al completar, la fila se queda un momento tachada para que se vea qué pasó. */
  const toggleDone = (note: Note) => {
    if (!note.done) {
      setJustCompleted((set) => new Set(set).add(note.id));
      timers.current.set(
        note.id,
        window.setTimeout(() => {
          setJustCompleted((set) => {
            const next = new Set(set);
            next.delete(note.id);
            return next;
          });
        }, COMPLETE_GRACE_MS),
      );
    }
    props.onToggleDone(note);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return notes.filter(
      (n) =>
        (!tagFilter || n.tags.some((t) => t.id === tagFilter)) &&
        (!q || `${n.title} ${n.body}`.toLocaleLowerCase('es').includes(q)),
    );
  }, [notes, query, tagFilter]);

  const pending = filtered.filter((n) => !n.done || justCompleted.has(n.id));
  const done = filtered.filter((n) => n.done && !justCompleted.has(n.id));
  const groups = groupByDue(pending);
  const totalPending = notes.filter((n) => !n.done).length;
  const dueToday = groups.find((g) => g.id === 'today')?.notes.length ?? 0;
  const overdue = groups.find((g) => g.id === 'overdue')?.notes.length ?? 0;
  const filtering = Boolean(query.trim() || tagFilter);

  const row = (note: Note, bucket: Parameters<typeof TaskRow>[0]['bucket']) => (
    <TaskRow
      key={note.id}
      note={note}
      bucket={bucket}
      selected={note.id === selectedId}
      onOpen={props.onOpen}
      onToggleDone={toggleDone}
    />
  );

  return (
    <aside className="panel">
      <header className="panel__header">
        <div>
          <h1 className="panel__title">{capitalize(todayFormat.format(new Date()))}</h1>
          <p className="panel__summary">{summary(totalPending, dueToday, overdue)}</p>
        </div>
        <button
          type="button"
          className={`icon-btn${pinned ? ' is-active' : ''}`}
          aria-pressed={pinned}
          title={pinned ? 'Dejar de fijar: se ocultará al salir' : 'Fijar: no se ocultará al salir'}
          onClick={props.onTogglePinned}
        >
          <PinIcon filled={pinned} />
        </button>
      </header>

      <QuickAdd ref={props.quickAddRef} onAdd={props.onQuickAdd} />

      {error && (
        <div className="panel__error" role="alert">
          <span>{error}</span>
          <button type="button" className="icon-btn icon-btn--small" aria-label="Cerrar aviso" onClick={props.onDismissError}>
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Qué tareas ver">
          <button type="button" role="tab" aria-selected={view === 'pending'} onClick={() => setView('pending')}>
            Pendientes <span className="count">{pending.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={view === 'done'} onClick={() => setView('done')}>
            Hechas <span className="count">{done.length}</span>
          </button>
        </div>
        <button
          type="button"
          className={`icon-btn${searchOpen ? ' is-active' : ''}`}
          aria-expanded={searchOpen}
          aria-label="Buscar"
          title="Buscar"
          onClick={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setQuery('');
          }}
        >
          <SearchIcon />
        </button>
      </div>

      {searchOpen && (
        <input
          className="search"
          type="search"
          autoFocus
          placeholder="Buscar por título o contenido"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {tags.length > 0 && (
        <div className="tag-filter" role="group" aria-label="Filtrar por etiqueta">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className="chip"
              aria-pressed={tagFilter === tag.id}
              onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
            >
              <span className="tag-dot" style={{ background: tag.color }} />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      <div className="panel__scroll">
        {view === 'pending' &&
          (groups.length > 0 ? (
            groups.map((group) => (
              <section key={group.id} className={`group group--${group.id}`} aria-labelledby={`g-${group.id}`}>
                <h2 id={`g-${group.id}`} className="group__title">
                  {group.label} <span className="count">{group.notes.length}</span>
                </h2>
                <ul className="task-list">{group.notes.map((n) => row(n, group.id))}</ul>
              </section>
            ))
          ) : (
            <EmptyState filtering={filtering} view="pending" />
          ))}

        {view === 'done' &&
          (done.length > 0 ? (
            <ul className="task-list">{done.map((n) => row(n, null))}</ul>
          ) : (
            <EmptyState filtering={filtering} view="done" />
          ))}
      </div>
    </aside>
  );
}

function EmptyState({ filtering, view }: { filtering: boolean; view: View }) {
  if (filtering) return <p className="empty">Ninguna tarea coincide con el filtro.</p>;
  if (view === 'done') return <p className="empty">Las tareas que completes aparecerán aquí.</p>;
  return (
    <div className="empty">
      <p className="empty__title">Todo al día</p>
      <p>Escribe arriba lo próximo que tengas que hacer y pulsa Enter. Con Ctrl+Alt+N abres este panel desde cualquier lugar.</p>
    </div>
  );
}

/** Resumen en lenguaje natural de la carga del día. */
function summary(pending: number, today: number, overdue: number): string {
  if (pending === 0) return 'Sin pendientes';
  const parts = [`${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`];
  if (overdue) parts.push(`${overdue} ${overdue === 1 ? 'vencida' : 'vencidas'}`);
  if (today) parts.push(`${today} para hoy`);
  return parts.join(', ');
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}
