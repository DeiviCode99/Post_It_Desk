import type { Note } from '../types';

/** Grupos de la lista según cuándo vence cada tarea. */
export type BucketId = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';

export interface TaskGroup {
  id: BucketId;
  label: string;
  notes: Note[];
}

const BUCKET_LABELS: ReadonlyArray<[BucketId, string]> = [
  ['overdue', 'Vencidas'],
  ['today', 'Hoy'],
  ['tomorrow', 'Mañana'],
  ['week', 'Esta semana'],
  ['later', 'Más adelante'],
  ['someday', 'Sin fecha'],
];

const DAY_MS = 86_400_000;
const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** Decide el grupo de una tarea comparando su fecha límite con hoy. */
export function bucketFor(note: Note, now = new Date()): BucketId {
  if (!note.dueAt) return 'someday';
  const due = new Date(note.dueAt);
  if (due.getTime() < now.getTime()) return 'overdue';
  const days = daysBetween(now, due);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return 'week';
  return 'later';
}

/** Agrupa conservando el orden recibido (prioridad y fecha) y omite grupos vacíos. */
export function groupByDue(notes: Note[], now = new Date()): TaskGroup[] {
  const groups = new Map<BucketId, Note[]>(BUCKET_LABELS.map(([id]) => [id, []]));
  for (const note of notes) groups.get(bucketFor(note, now))!.push(note);
  return BUCKET_LABELS.map(([id, label]) => ({ id, label, notes: groups.get(id)! })).filter(
    (g) => g.notes.length > 0,
  );
}

/** Texto de fecha de una fila: dentro de Hoy/Mañana basta la hora; en el resto, el día. */
export function rowDueLabel(note: Note, bucket: BucketId): string | null {
  if (!note.dueAt) return null;
  const due = new Date(note.dueAt);
  if (bucket === 'today' || bucket === 'tomorrow') return timeFormat.format(due);
  return dayFormat.format(due);
}
