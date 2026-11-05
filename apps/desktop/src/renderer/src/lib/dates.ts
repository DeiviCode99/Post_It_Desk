/** Etiqueta corta de la fecha límite y el tono con que se pinta en la lista. */
export interface DueLabel {
  text: string;
  tone: 'overdue' | 'soon' | 'normal';
}

const DAY_MS = 86_400_000;
const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });

/** Medianoche local del día dado, para comparar por días calendario. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "Vencida", "Hoy 3:00 p. m.", "Mañana", "5 nov." según qué tan cerca esté. */
export function describeDue(iso: string, now = new Date()): DueLabel {
  const due = new Date(iso);
  if (due.getTime() < now.getTime()) return { text: `Vencida · ${dayFormat.format(due)}`, tone: 'overdue' };

  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (days === 0) return { text: `Hoy ${timeFormat.format(due)}`, tone: 'soon' };
  if (days === 1) return { text: `Mañana ${timeFormat.format(due)}`, tone: 'soon' };
  return { text: dayFormat.format(due), tone: 'normal' };
}

/** ISO → valor de <input type="datetime-local"> en hora local. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> → ISO en UTC (o null si está vacío). */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

/** Anticipaciones de recordatorio ofrecidas, en minutos antes de la fecha límite. */
export const REMINDER_OFFSETS = [
  { minutes: 0, label: 'A la hora límite' },
  { minutes: 15, label: '15 minutos antes' },
  { minutes: 60, label: '1 hora antes' },
  { minutes: 1440, label: '1 día antes' },
] as const;

export function remindAtFor(dueIso: string, minutesBefore: number): string {
  return new Date(new Date(dueIso).getTime() - minutesBefore * 60_000).toISOString();
}

/** Minutos entre recordatorio y fecha límite; null si no hay alguno de los dos. */
export function offsetMinutes(dueIso: string | null, remindIso: string | null): number | null {
  if (!dueIso || !remindIso) return null;
  return Math.round((new Date(dueIso).getTime() - new Date(remindIso).getTime()) / 60_000);
}
