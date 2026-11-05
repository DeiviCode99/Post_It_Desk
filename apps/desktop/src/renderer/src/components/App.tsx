import { useCallback, useEffect, useRef, useState } from 'react';
import { NotesApi } from '../api/NotesApi';
import { useEdgeMode } from '../hooks/useEdgeMode';
import { useNotesStore } from '../hooks/useNotesStore';
import type { Note } from '../types';
import { EdgeHandle } from './EdgeHandle';
import { NotePanel } from './NotePanel';
import { NoteSheet } from './NoteSheet';

/**
 * Composición de la ventana lateral. Según el estado muestra la franja,
 * el panel solo, o el panel con la hoja de la tarea seleccionada a su izquierda.
 */
export function App() {
  const [api, setApi] = useState<NotesApi | null>(null);
  const store = useNotesStore(api);
  const { reload, flush, createNote, patchNote } = store;
  const { mode, closing, setMode, pinned, togglePinned } = useEdgeMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void window.desktop.getBackendConfig().then((config) => setApi(new NotesApi(config)));
  }, []);

  const openNote = useCallback(
    (id: string) => {
      setSelectedId(id);
      setMode('sheet');
    },
    [setMode],
  );

  const closeSheet = useCallback(() => {
    if (selectedId) void flush(selectedId);
    setSelectedId(null);
    setMode('list');
  }, [selectedId, setMode, flush]);

  const quickAdd = useCallback(
    async (title: string) => {
      await createNote(title);
    },
    [createNote],
  );

  const toggleDone = useCallback((note: Note) => patchNote(note.id, { done: !note.done }), [patchNote]);

  // Avisos del proceso principal: clic en una notificación o "Nueva nota" en la bandeja.
  useEffect(() => {
    const offOpen = window.desktop.onOpenNote((id) => {
      setSelectedId(id);
      void reload();
    });
    // "Nueva nota" lleva el foco a la captura rápida en vez de crear una tarea vacía.
    const offNew = window.desktop.onNewNote(() => quickAddRef.current?.focus());
    return () => {
      offOpen();
      offNew();
    };
  }, [reload]);

  // Al replegar se cierra la hoja; al volver, la lista llega actualizada.
  useEffect(() => {
    if (mode === 'collapsed') {
      void reload();
      setSelectedId(null);
    }
  }, [mode, reload]);

  const selected = store.notes.find((n) => n.id === selectedId) ?? null;

  if (mode === 'collapsed') {
    return <EdgeHandle notes={store.notes} onEnter={() => setMode('list')} />;
  }

  return (
    <div className={`app${closing ? ' is-closing' : ''}`}>
      {mode === 'sheet' && (
        <section className="desk" aria-label="Tarea abierta">
          {selected ? (
            <NoteSheet
              key={selected.id}
              note={selected}
              tags={store.tags}
              onPatch={(patch) => patchNote(selected.id, patch)}
              onClose={closeSheet}
              onDelete={() => {
                void store.removeNote(selected.id);
                closeSheet();
              }}
              onCreateTag={store.createTag}
            />
          ) : (
            <p className="empty">Esta tarea ya no existe.</p>
          )}
        </section>
      )}
      <NotePanel
        notes={store.notes}
        tags={store.tags}
        selectedId={selectedId}
        pinned={pinned}
        error={store.error}
        quickAddRef={quickAddRef}
        onOpen={(id) => (id === selectedId ? closeSheet() : openNote(id))}
        onToggleDone={toggleDone}
        onQuickAdd={quickAdd}
        onTogglePinned={() => void togglePinned()}
        onDismissError={store.dismissError}
      />
    </div>
  );
}
