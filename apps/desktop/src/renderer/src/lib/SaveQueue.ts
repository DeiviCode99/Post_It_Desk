import type { NotePatch } from '../types';

/**
 * Agrupa los cambios de cada nota y los envía tras una pausa al escribir
 * (autoguardado). Así teclear un párrafo produce una sola petición.
 */
export class SaveQueue {
  private readonly pending = new Map<string, NotePatch>();
  private readonly timers = new Map<string, number>();

  constructor(
    private readonly send: (noteId: string, patch: NotePatch) => Promise<void>,
    private readonly delayMs = 450,
  ) {}

  schedule(noteId: string, patch: NotePatch): void {
    this.pending.set(noteId, { ...this.pending.get(noteId), ...patch });
    window.clearTimeout(this.timers.get(noteId));
    this.timers.set(noteId, window.setTimeout(() => void this.flush(noteId), this.delayMs));
  }

  /** Envía ya lo pendiente de una nota (al cerrar la hoja o replegar el panel). */
  async flush(noteId: string): Promise<void> {
    const patch = this.pending.get(noteId);
    window.clearTimeout(this.timers.get(noteId));
    this.timers.delete(noteId);
    if (!patch) return;
    this.pending.delete(noteId);
    await this.send(noteId, patch);
  }

  flushAll(): Promise<void[]> {
    return Promise.all([...this.pending.keys()].map((id) => this.flush(id)));
  }

  hasPending(noteId: string): boolean {
    return this.pending.has(noteId);
  }

  /** Descarta cambios pendientes de una nota que se va a borrar. */
  discard(noteId: string): void {
    window.clearTimeout(this.timers.get(noteId));
    this.timers.delete(noteId);
    this.pending.delete(noteId);
  }
}
