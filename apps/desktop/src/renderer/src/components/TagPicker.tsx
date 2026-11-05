import { useState } from 'react';
import type { Tag } from '../types';

interface TagPickerProps {
  tags: Tag[];
  selected: Tag[];
  onChange: (tagIds: string[]) => void;
  onCreate: (name: string) => Promise<Tag | null>;
}

/** Activa o desactiva etiquetas en la nota y permite crear una nueva al vuelo. */
export function TagPicker({ tags, selected, onChange, onCreate }: TagPickerProps) {
  const [draft, setDraft] = useState('');
  const selectedIds = selected.map((t) => t.id);

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const create = async () => {
    const name = draft.trim();
    if (!name) return;
    const existing = tags.find((t) => t.name.toLocaleLowerCase('es') === name.toLocaleLowerCase('es'));
    const tag = existing ?? (await onCreate(name));
    if (tag && !selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id]);
    setDraft('');
  };

  return (
    <div className="tag-picker" role="group" aria-label="Etiquetas de la nota">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className="chip chip--paper"
            aria-pressed={selectedIds.includes(tag.id)}
            onClick={() => toggle(tag.id)}
          >
            <span className="tag-dot" style={{ background: tag.color }} />
            {tag.name}
          </button>
        ))}
        <input
          className="tag-picker__new"
          placeholder="+ Nueva"
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
    </div>
  );
}
