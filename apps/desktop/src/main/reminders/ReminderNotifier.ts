import { Notification } from 'electron';
import type { ApiClient } from '../backend/ApiClient';

interface DueNote {
  id: string;
  title: string;
  body: string;
}

/**
 * Consulta periódicamente los recordatorios vencidos y los muestra como
 * notificaciones de Windows. Al hacer clic se abre esa nota en el panel.
 */
export class ReminderNotifier {
  private timer: NodeJS.Timeout | null = null;
  /** Referencias vivas: si el GC recoge la notificación, Windows pierde el clic. */
  private readonly visible = new Set<Notification>();

  constructor(
    private readonly api: ApiClient,
    private readonly onOpenNote: (noteId: string) => void,
    private readonly intervalMs = 30_000,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    try {
      const due = await this.api.get<DueNote[]>('/reminders/due');
      for (const note of due) {
        this.show(note);
        await this.api.post(`/reminders/${note.id}/ack`);
      }
    } catch (error) {
      // Un fallo puntual no debe tumbar la app; se reintenta en el próximo ciclo.
      console.error('[recordatorios]', error);
    }
  }

  private show(note: DueNote): void {
    const notification = new Notification({
      title: note.title,
      body: note.body.trim().slice(0, 120) || 'Tienes esta tarea pendiente.',
    });
    notification.on('click', () => this.onOpenNote(note.id));
    notification.on('close', () => this.visible.delete(notification));
    this.visible.add(notification);
    notification.show();
  }
}
