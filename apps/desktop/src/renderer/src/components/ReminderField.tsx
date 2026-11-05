import { REMINDER_OFFSETS, offsetMinutes, remindAtFor } from '../lib/dates';

interface ReminderFieldProps {
  id?: string;
  dueAt: string | null;
  remindAt: string | null;
  onChange: (remindAt: string | null) => void;
}

/** Aviso relativo a la fecha límite; sin fecha límite no hay a qué anclarlo. */
export function ReminderField({ id, dueAt, remindAt, onChange }: ReminderFieldProps) {
  const offset = offsetMinutes(dueAt, remindAt);
  const value = offset === null ? '' : String(offset);
  const isCustom = offset !== null && !REMINDER_OFFSETS.some((o) => o.minutes === offset);

  return (
    <select
      id={id}
      value={value}
      disabled={!dueAt}
      onChange={(e) => onChange(e.target.value && dueAt ? remindAtFor(dueAt, Number(e.target.value)) : null)}
    >
      <option value="">{dueAt ? 'Sin aviso' : 'Pon primero una fecha'}</option>
      {REMINDER_OFFSETS.map((o) => (
        <option key={o.minutes} value={o.minutes}>
          {o.label}
        </option>
      ))}
      {isCustom && <option value={value}>Personalizado</option>}
    </select>
  );
}
