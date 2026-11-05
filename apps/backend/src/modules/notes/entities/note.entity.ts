import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Priority } from '../enums/priority.enum';
import { ChecklistItem } from './checklist-item.entity';

/** Nota/tarea: el post-it que se muestra en la pestaña lateral. */
@Entity('notes')
export class Note extends BaseEntity {
  @Column({ length: 120 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: 'simple-enum', enum: Priority, default: Priority.None })
  priority: Priority;

  @Column({ type: 'datetime', nullable: true })
  dueAt: Date | null;

  /** Momento en que debe saltar la notificación; null = sin recordatorio. */
  @Column({ type: 'datetime', nullable: true })
  remindAt: Date | null;

  /** Se llena cuando Electron ya mostró la notificación, para no repetirla. */
  @Column({ type: 'datetime', nullable: true })
  reminderSentAt: Date | null;

  @Column({ default: false })
  done: boolean;

  /** Orden manual dentro de la lista (menor primero). */
  @Column({ type: 'integer', default: 0 })
  position: number;

  @OneToMany(() => ChecklistItem, (item) => item.note, {
    cascade: true,
    eager: true,
    orphanedRowAction: 'delete',
  })
  checklist: ChecklistItem[];

  @ManyToMany(() => Tag, (tag) => tag.notes, { eager: true })
  @JoinTable({
    name: 'note_tags',
    joinColumn: { name: 'noteId' },
    inverseJoinColumn: { name: 'tagId' },
  })
  tags: Tag[];

  /** Una nota está vencida si tiene fecha límite pasada y sigue pendiente. */
  isOverdue(now: Date = new Date()): boolean {
    return !this.done && this.dueAt !== null && this.dueAt.getTime() < now.getTime();
  }
}
