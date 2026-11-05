import { PRIORITIES } from '../lib/priority';
import type { Priority } from '../types';

interface PriorityPickerProps {
  value: Priority;
  onChange: (value: Priority) => void;
}

/** Control segmentado: cada opción muestra su color y su nombre, nunca solo el color. */
export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <div role="radiogroup" aria-label="Prioridad" className="priority-picker">
      {PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={p.value === value}
          className={`priority-picker__option priority-${p.value}`}
          onClick={() => onChange(p.value)}
        >
          <span className="priority-picker__dot" />
          {p.short}
        </button>
      ))}
    </div>
  );
}
