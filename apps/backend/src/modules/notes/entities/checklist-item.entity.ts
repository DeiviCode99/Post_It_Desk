import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Note } from './note.entity';

/** Subtarea marcable dentro de una nota. Se guarda y borra junto con su nota. */
@Entity('checklist_items')
export class ChecklistItem extends BaseEntity {
  @Column({ length: 200 })
  text: string;

  @Column({ default: false })
  done: boolean;

  @Column({ type: 'integer', default: 0 })
  position: number;

  @ManyToOne(() => Note, (note) => note.checklist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'noteId' })
  note: Note;
}
