import { forwardRef, useState } from 'react';
import { PlusIcon } from './icons';

interface QuickAddProps {
  onAdd: (title: string) => Promise<void>;
}

/** Captura rápida: escribir y Enter crea la tarea sin abrir la hoja. */
export const QuickAdd = forwardRef<HTMLInputElement, QuickAddProps>(function QuickAdd({ onAdd }, ref) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = title.trim();
    if (!value || saving) return;
    setSaving(true);
    await onAdd(value.slice(0, 120));
    setTitle('');
    setSaving(false);
  };

  return (
    <form
      className="quick-add"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <PlusIcon />
      <input
        ref={ref}
        value={title}
        maxLength={120}
        aria-label="Nueva tarea"
        placeholder="Añadir tarea y pulsar Enter"
        onChange={(e) => setTitle(e.target.value)}
      />
    </form>
  );
});
