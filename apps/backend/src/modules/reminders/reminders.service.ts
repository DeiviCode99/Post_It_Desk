import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Note } from '../notes/entities/note.entity';

/**
 * Decide qué recordatorios tocan ahora. Mostrar la notificación es tarea de
 * Electron; este servicio solo responde "cuáles" y registra que ya se avisó.
 */
@Injectable()
export class RemindersService {
  constructor(@InjectRepository(Note) private readonly notes: Repository<Note>) {}

  /** Notas pendientes con recordatorio vencido que aún no se han notificado. */
  findDue(now: Date = new Date()): Promise<Note[]> {
    return this.notes.find({
      where: { done: false, reminderSentAt: IsNull(), remindAt: LessThanOrEqual(now) },
      order: { remindAt: 'ASC' },
    });
  }

  /** Marca el recordatorio como mostrado para que no vuelva a salir. */
  async acknowledge(id: string, now: Date = new Date()): Promise<void> {
    const result = await this.notes.update({ id }, { reminderSentAt: now });
    if (!result.affected) throw new NotFoundException(`Nota ${id} no encontrada`);
  }
}
