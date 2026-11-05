import { rowDueLabel, type BucketId } from '../lib/grouping';
import type { Note } from '../types';
import { CheckIcon } from './icons';

interface TaskRowProps {
  note: Note;
  bucket: BucketId | null;
  selected: boolean;
  onOpen: (id: string) => void;
  onToggleDone: (note: Note) => void;
}

const PRIORITY_NAMES = { high: 'prioridad alta', medium: 'prioridad media', low: 'prioridad baja', none: '' };

/**
 * Fila de tarea: el círculo (del color de la prioridad) la completa; el resto
 * de la fila la abre. Son dos botones separados para que ambos sean accesibles.
 */
export function TaskRow({ note, bucket, selected, onOpen, onToggleDone }: TaskRowProps) {
  const due = bucket ? rowDueLabel(note, bucket) : null;
  const doneItems = note.checklist.filter((i) => i.done).length;
  const priority = PRIORITY_NAMES[note.priority];

  return (
    <li className={`task priority-${note.priority}${selected ? ' is-selected' : ''}${note.done ? ' is-done' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={note.done}
        aria-label={`${note.done ? 'Reabrir' : 'Completar'} "${note.title}"`}
        className="task__check"
        onClick={() => onToggleDone(note)}
      >
        <span className="task__ring">
          <CheckIcon />
        </span>
      </button>
      <button
        type="button"
        className="task__body"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(note.id)}
      >
        <span className="task__title">{note.title}</span>
        {(due || note.checklist.length > 0 || note.tags.length > 0 || priority) && (
          <span className="task__meta">
            {due && <span className={bucket === 'overdue' ? 'is-overdue' : undefined}>{due}</span>}
            {note.checklist.length > 0 && (
              <span className="task__progress">
                {doneItems}/{note.checklist.length}
              </span>
            )}
            {note.tags.map((tag) => (
              <span key={tag.id} className="task__tag">
                <span className="tag-dot" style={{ background: tag.color }} />
                {tag.name}
              </span>
            ))}
            {priority && <span className="visually-hidden">{priority}</span>}
          </span>
        )}
      </button>
    </li>
  );
}
