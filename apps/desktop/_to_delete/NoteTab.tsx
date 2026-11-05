import { describeDue } from '../lib/dates';
import type { Note } from '../types';

interface NoteTabProps {
  note: Note;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** Pestaña de una nota en la lista: título, fecha, avance del checklist y etiquetas. */
export function NoteTab({ note, selected, onSelect }: NoteTabProps) {
  const due = note.dueAt && !note.done ? describeDue(note.dueAt) : null;
  const doneItems = note.checklist.filter((i) => i.done).length;

  return (
    <li>
      <button
        type="button"
        className={`note-tab priority-${note.priority}${selected ? ' is-selected' : ''}${note.done ? ' is-done' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(note.id)}
      >
        <span className="note-tab__title">{note.title}</span>
        <span className="note-tab__meta">
          {due && <span className={`due due--${due.tone}`}>{due.text}</span>}
          {note.checklist.length > 0 && (
            <span>
              {doneItems}/{note.checklist.length}
            </span>
          )}
          {note.tags.map((tag) => (
            <span key={tag.id} className="tag-dot" style={{ background: tag.color }} title={tag.name} />
          ))}
        </span>
      </button>
    </li>
  );
}
