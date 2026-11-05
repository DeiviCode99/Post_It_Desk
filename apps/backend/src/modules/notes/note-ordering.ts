import { Note } from './entities/note.entity';
import { PRIORITY_WEIGHT } from './enums/priority.enum';

/**
 * Criterio de orden de la pestaña lateral:
 * pendientes antes que hechas → mayor prioridad → fecha límite más cercana
 * (sin fecha al final) → posición manual → más reciente.
 */
export class NoteOrdering {
  static compare(a: Note, b: Note): number {
    return (
      Number(a.done) - Number(b.done) ||
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
      NoteOrdering.dueTime(a) - NoteOrdering.dueTime(b) ||
      a.position - b.position ||
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  static sort(notes: Note[]): Note[] {
    return [...notes].sort(NoteOrdering.compare);
  }

  private static dueTime(note: Note): number {
    return note.dueAt ? note.dueAt.getTime() : Number.POSITIVE_INFINITY;
  }
}
