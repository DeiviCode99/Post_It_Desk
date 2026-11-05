import { Note } from './entities/note.entity';
import { Priority } from './enums/priority.enum';
import { NoteOrdering } from './note-ordering';

/** Crea una nota en memoria con valores por defecto sobreescribibles. */
function makeNote(overrides: Partial<Note>): Note {
  return Object.assign(new Note(), {
    title: 'nota',
    priority: Priority.None,
    done: false,
    dueAt: null,
    position: 0,
    createdAt: new Date('2026-11-01T00:00:00Z'),
    ...overrides,
  });
}

describe('NoteOrdering', () => {
  it('pone las pendientes antes que las hechas', () => {
    const done = makeNote({ title: 'hecha', done: true, priority: Priority.High });
    const pending = makeNote({ title: 'pendiente' });
    expect(NoteOrdering.sort([done, pending]).map((n) => n.title)).toEqual(['pendiente', 'hecha']);
  });

  it('ordena por prioridad y luego por fecha límite, sin fecha al final', () => {
    const notes = [
      makeNote({ title: 'media-sin-fecha', priority: Priority.Medium }),
      makeNote({ title: 'media-mañana', priority: Priority.Medium, dueAt: new Date('2026-11-02') }),
      makeNote({ title: 'alta', priority: Priority.High }),
      makeNote({ title: 'baja', priority: Priority.Low, dueAt: new Date('2026-11-01') }),
    ];
    expect(NoteOrdering.sort(notes).map((n) => n.title)).toEqual([
      'alta',
      'media-mañana',
      'media-sin-fecha',
      'baja',
    ]);
  });
});

describe('Note.isOverdue', () => {
  const now = new Date('2026-11-01T12:00:00Z');

  it('es verdadero si la fecha pasó y sigue pendiente', () => {
    expect(makeNote({ dueAt: new Date('2026-11-01T11:00:00Z') }).isOverdue(now)).toBe(true);
  });

  it('es falso si ya está hecha o no tiene fecha', () => {
    expect(makeNote({ dueAt: new Date('2026-10-01'), done: true }).isOverdue(now)).toBe(false);
    expect(makeNote({}).isOverdue(now)).toBe(false);
  });
});
