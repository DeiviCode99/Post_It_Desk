import { useEffect, useState } from 'react';
import { fromLocalInput, offsetMinutes, remindAtFor, toLocalInput } from '../lib/dates';
import type { Note, NotePatch, Tag } from '../types';
import { ChecklistEditor } from './ChecklistEditor';
import { PriorityPicker } from './PriorityPicker';
import { ReminderField } from './ReminderField';
import { TagPicker } from './TagPicker';
import { CheckIcon, CloseIcon } from './icons';

interface NoteSheetProps {
  note: Note;
  tags: Tag[];
  onPatch: (patch: NotePatch) => void;
  onClose: () => void;
  onDelete: () => void;
  onCreateTag: (name: string) => Promise<Tag | null>;
}

const UNTITLED = 'Sin título';
const createdFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long' });

/**
 * La nota desplegada como post-it. Orden de lectura: qué es (título),
 * cuándo y cuánto importa (propiedades), cómo se hace (subtareas) y
 * detalles libres (notas). Todo se autoguarda.
 */
export function NoteSheet({ note, tags, onPatch, onClose, onDelete, onCreateTag }: NoteSheetProps) {
  // El título vive en estado local para poder quedar vacío mientras se escribe;
  // el backend solo recibe títulos no vacíos.
  const [title, setTitle] = useState(note.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const changeTitle = (value: string) => {
    const clean = value.replace(/\n/g, ' ');
    setTitle(clean);
    if (clean.trim()) onPatch({ title: clean });
  };

  /** Al mover la fecha límite, el recordatorio conserva su anticipación. */
  const changeDue = (value: string) => {
    const dueAt = fromLocalInput(value);
    const offset = offsetMinutes(note.dueAt, note.remindAt);
    const remindAt = dueAt && offset !== null ? remindAtFor(dueAt, offset) : null;
    onPatch(note.remindAt !== remindAt ? { dueAt, remindAt } : { dueAt });
  };

  const doneItems = note.checklist.filter((i) => i.done).length;

  return (
    <article
      className={`sheet priority-${note.priority}${note.done ? ' is-done' : ''}`}
      aria-label={`Nota: ${title || UNTITLED}`}
    >
      <header className="sheet__head">
        <button
          type="button"
          role="checkbox"
          aria-checked={note.done}
          aria-label={note.done ? 'Reabrir tarea' : 'Completar tarea'}
          className="task__check task__check--sheet"
          onClick={() => onPatch({ done: !note.done })}
        >
          <span className="task__ring">
            <CheckIcon />
          </span>
        </button>
        {/* Textarea para que el título largo baje de línea; su altura la ajusta CSS (field-sizing). */}
        <textarea
          rows={1}
          className="sheet__title"
          value={title}
          maxLength={120}
          aria-label="Título"
          placeholder={UNTITLED}
          onChange={(e) => changeTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          onBlur={() => !title.trim() && changeTitle(UNTITLED)}
        />
        <button type="button" className="icon-btn" aria-label="Cerrar nota" title="Cerrar (Esc)" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <dl className="props">
        <div className="props__row">
          <dt>Prioridad</dt>
          <dd>
            <PriorityPicker value={note.priority} onChange={(priority) => onPatch({ priority })} />
          </dd>
        </div>
        <div className="props__row">
          <dt>
            <label htmlFor="due-input">Vence</label>
          </dt>
          <dd>
            <input
              id="due-input"
              type="datetime-local"
              value={toLocalInput(note.dueAt)}
              onChange={(e) => changeDue(e.target.value)}
            />
          </dd>
        </div>
        <div className="props__row">
          <dt>
            <label htmlFor="reminder-input">Aviso</label>
          </dt>
          <dd>
            <ReminderField
              id="reminder-input"
              dueAt={note.dueAt}
              remindAt={note.remindAt}
              onChange={(remindAt) => onPatch({ remindAt })}
            />
          </dd>
        </div>
        <div className="props__row props__row--top">
          <dt>Etiquetas</dt>
          <dd>
            <TagPicker tags={tags} selected={note.tags} onChange={(tagIds) => onPatch({ tagIds })} onCreate={onCreateTag} />
          </dd>
        </div>
      </dl>

      <section className="sheet__section" aria-labelledby="checklist-title">
        <h3 id="checklist-title" className="sheet__heading">
          Subtareas
          {note.checklist.length > 0 && (
            <span className="count">
              {doneItems} de {note.checklist.length}
            </span>
          )}
        </h3>
        <ChecklistEditor items={note.checklist} onChange={(checklist) => onPatch({ checklist })} />
      </section>

      <section className="sheet__section" aria-labelledby="notes-title">
        <h3 id="notes-title" className="sheet__heading">
          Notas
        </h3>
        <textarea
          className="sheet__body"
          value={note.body}
          aria-labelledby="notes-title"
          placeholder="Detalles, enlaces, ideas…"
          onChange={(e) => onPatch({ body: e.target.value })}
        />
      </section>

      <footer className="sheet__foot">
        <span className="sheet__created">Creada el {createdFormat.format(new Date(note.createdAt))}</span>
        {confirmingDelete ? (
          <span className="confirm" role="group" aria-label="Confirmar eliminación">
            <button type="button" className="btn btn--quiet" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn--danger" onClick={onDelete}>
              Eliminar tarea
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn--quiet" onClick={() => setConfirmingDelete(true)}>
            Eliminar
          </button>
        )}
      </footer>
    </article>
  );
}
