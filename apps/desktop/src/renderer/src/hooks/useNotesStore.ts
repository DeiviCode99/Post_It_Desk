import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NotesApi } from '../api/NotesApi';
import { SaveQueue } from '../lib/SaveQueue';
import { TAG_COLORS } from '../lib/priority';
import type { Note, NotePatch, Tag } from '../types';

/**
 * Estado de notas y etiquetas con actualizaciones optimistas: la interfaz
 * cambia al instante y el guardado ocurre en segundo plano.
 */
export function useNotesStore(api: NotesApi | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [error, setError] = useState<string | null>(null);

  const report = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : 'Algo salió mal al guardar.');
  }, []);

  const queue = useMemo(() => {
    const saveQueue: SaveQueue = new SaveQueue(async (id, patch) => {
      if (!api) return;
      try {
        const saved = await api.updateNote(id, patch);
        // Se adoptan los ids de subtareas que asignó el servidor, salvo que el
        // usuario ya haya hecho otro cambio que todavía está por enviarse.
        if (saveQueue.hasPending(id)) return;
        setNotes((list) =>
          list.map((n) => (n.id === id ? { ...n, checklist: saved.checklist, updatedAt: saved.updatedAt } : n)),
        );
      } catch (err) {
        report(err);
      }
    });
    return saveQueue;
  }, [api, report]);

  const reload = useCallback(async () => {
    if (!api) return;
    try {
      await queue.flushAll();
      const [noteList, tagList] = await Promise.all([api.listNotes(), api.listTags()]);
      setNotes(noteList);
      setTags(tagList);
    } catch (err) {
      report(err);
    }
  }, [api, queue, report]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createNote = useCallback(async (title = 'Nueva tarea'): Promise<Note | null> => {
    if (!api) return null;
    try {
      const note = await api.createNote({ title });
      setNotes((list) => [note, ...list]);
      return note;
    } catch (err) {
      report(err);
      return null;
    }
  }, [api, report]);

  /** Aplica el cambio en pantalla y lo encola para guardarlo. */
  const patchNote = useCallback(
    (id: string, patch: NotePatch) => {
      setNotes((list) =>
        list.map((note) => {
          if (note.id !== id) return note;
          const { tagIds, ...fields } = patch;
          const nextTags = tagIds ? tags.filter((t) => tagIds.includes(t.id)) : note.tags;
          return { ...note, ...fields, tags: nextTags };
        }),
      );
      queue.schedule(id, patch);
    },
    [queue, tags],
  );

  const removeNote = useCallback(
    async (id: string) => {
      if (!api) return;
      queue.discard(id);
      setNotes((list) => list.filter((n) => n.id !== id));
      try {
        await api.deleteNote(id);
      } catch (err) {
        report(err);
        void reload();
      }
    },
    [api, queue, reload, report],
  );

  const createTag = useCallback(
    async (name: string): Promise<Tag | null> => {
      if (!api) return null;
      try {
        const tag = await api.createTag(name, TAG_COLORS[tags.length % TAG_COLORS.length]);
        setTags((list) => [...list, tag].sort((a, b) => a.name.localeCompare(b.name)));
        return tag;
      } catch (err) {
        report(err);
        return null;
      }
    },
    [api, tags.length, report],
  );

  const dismissError = useCallback(() => setError(null), []);
  const flush = useCallback((id: string) => queue.flush(id), [queue]);

  // Todas las funciones son estables (useCallback) para usarlas como dependencias de efectos.
  return {
    notes,
    tags,
    error,
    dismissError,
    reload,
    flush,
    createNote,
    patchNote,
    removeNote,
    createTag,
  };
}
