import type { Note } from '../types';

interface EdgeHandleProps {
  notes: Note[];
  onEnter: () => void;
}

/** Máximo de marcas: más no caben con sentido en la pestaña. */
const MAX_MARKS = 7;

/**
 * Pestaña del borde con el panel oculto. Cada marca es una tarea pendiente
 * pintada con su prioridad (roja si está vencida): de reojo se ve la carga.
 */
export function EdgeHandle({ notes, onEnter }: EdgeHandleProps) {
  const now = Date.now();
  const pending = notes.filter((n) => !n.done).slice(0, MAX_MARKS);
  const overdue = (n: Note) => n.dueAt !== null && new Date(n.dueAt).getTime() < now;

  return (
    <div className="edge-handle" onMouseEnter={onEnter} role="button" aria-label={`Mostrar tareas (${pending.length} pendientes)`}>
      {pending.length === 0 ? (
        <span className="edge-handle__mark edge-handle__mark--empty" />
      ) : (
        pending.map((note) => (
          <span key={note.id} className={`edge-handle__mark priority-${note.priority}${overdue(note) ? ' is-overdue' : ''}`} />
        ))
      )}
    </div>
  );
}
