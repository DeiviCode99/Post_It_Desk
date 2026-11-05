import { Column, Entity, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Note } from '../../notes/entities/note.entity';

/** Etiqueta o categoría reutilizable (p. ej. "Universidad", "Personal"). */
@Entity('tags')
export class Tag extends BaseEntity {
  @Column({ length: 40, unique: true })
  name: string;

  /** Color en hexadecimal (#RRGGBB) usado para el punto de la etiqueta. */
  @Column({ length: 7, default: '#8EC5FF' })
  color: string;

  @ManyToMany(() => Note, (note) => note.tags)
  notes: Note[];
}
