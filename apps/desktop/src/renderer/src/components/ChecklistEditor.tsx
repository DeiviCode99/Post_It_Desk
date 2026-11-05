import { useState } from 'react';
import type { ChecklistItem } from '../types';
import { CloseIcon } from './icons';

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

/** Subtareas: marcar, renombrar, quitar y añadir con Enter. */
export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [draft, setDraft] = useState('');

  const update = (index: number, change: Partial<ChecklistItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...change } : item)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { text, done: false }]);
    setDraft('');
  };

  return (
    <div className="checklist">
      <ul>
        {items.map((item, index) => (
          <li key={item.id ?? `nuevo-${index}`} className={item.done ? 'is-done' : undefined}>
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Marcar "${item.text}"`}
              onChange={(e) => update(index, { done: e.target.checked })}
            />
            <input
              className="checklist__text"
              value={item.text}
              maxLength={200}
              aria-label="Texto de la subtarea"
              onChange={(e) => update(index, { text: e.target.value })}
              // Una subtarea vaciada se elimina al salir del campo (el backend no acepta vacías).
              onBlur={() => !item.text.trim() && remove(index)}
            />
            <button type="button" className="icon-btn icon-btn--small" aria-label="Quitar subtarea" onClick={() => remove(index)}>
              <CloseIcon />
            </button>
          </li>
        ))}
      </ul>
      <input
        className="checklist__add"
        placeholder="Añadir subtarea y pulsar Enter"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
    </div>
  );
}
