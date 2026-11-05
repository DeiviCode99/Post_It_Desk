import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagsService } from '../tags/tags.service';
import { ChecklistItemDto } from './dto/checklist-item.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { ChecklistItem } from './entities/checklist-item.entity';
import { Note } from './entities/note.entity';
import { NoteOrdering } from './note-ordering';

/** Casos de uso de las notas: listar, crear, editar y borrar. */
@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private readonly notes: Repository<Note>,
    private readonly tagsService: TagsService,
  ) {}

  async findAll(): Promise<Note[]> {
    return NoteOrdering.sort(await this.notes.find());
  }

  async findOne(id: string): Promise<Note> {
    const note = await this.notes.findOneBy({ id });
    if (!note) throw new NotFoundException(`Nota ${id} no encontrada`);
    return note;
  }

  async create(dto: CreateNoteDto): Promise<Note> {
    const note = this.notes.create({ checklist: [], tags: [] });
    await this.applyChanges(note, dto);
    return this.notes.save(note);
  }

  async update(id: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.findOne(id);
    await this.applyChanges(note, dto);
    if (dto.done !== undefined) note.done = dto.done;
    await this.notes.save(note);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.notes.remove(await this.findOne(id));
  }

  /** Copia en la entidad solo los campos presentes en el DTO. */
  private async applyChanges(note: Note, dto: CreateNoteDto | UpdateNoteDto): Promise<void> {
    if (dto.title !== undefined) note.title = dto.title.trim();
    if (dto.body !== undefined) note.body = dto.body;
    if (dto.priority !== undefined) note.priority = dto.priority;
    if (dto.position !== undefined) note.position = dto.position;
    if (dto.dueAt !== undefined) note.dueAt = this.toDate(dto.dueAt);

    if (dto.remindAt !== undefined) {
      note.remindAt = this.toDate(dto.remindAt);
      // Un recordatorio nuevo o movido debe volver a notificarse.
      note.reminderSentAt = null;
    }
    if (dto.tagIds !== undefined) note.tags = await this.tagsService.findByIds(dto.tagIds);
    if (dto.checklist !== undefined) note.checklist = this.buildChecklist(note, dto.checklist);
  }

  /** Reconstruye la lista conservando los ids existentes para no perder historial. */
  private buildChecklist(note: Note, items: ChecklistItemDto[]): ChecklistItem[] {
    const current = new Map((note.checklist ?? []).map((item) => [item.id, item]));
    return items.map((dto, index) => {
      const item = (dto.id && current.get(dto.id)) || new ChecklistItem();
      item.text = dto.text.trim();
      item.done = dto.done ?? item.done ?? false;
      item.position = index;
      return item;
    });
  }

  private toDate(value: string | null): Date | null {
    return value === null ? null : new Date(value);
  }
}
