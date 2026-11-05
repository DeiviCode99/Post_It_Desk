import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './entities/tag.entity';

/** Casos de uso de etiquetas. Otros módulos lo usan para resolver ids → entidades. */
@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly tags: Repository<Tag>) {}

  findAll(): Promise<Tag[]> {
    return this.tags.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateTagDto): Promise<Tag> {
    await this.ensureNameIsFree(dto.name);
    return this.tags.save(this.tags.create({ name: dto.name.trim(), color: dto.color }));
  }

  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findOne(id);
    if (dto.name && dto.name !== tag.name) await this.ensureNameIsFree(dto.name);
    Object.assign(tag, { ...dto, name: dto.name?.trim() ?? tag.name });
    return this.tags.save(tag);
  }

  async remove(id: string): Promise<void> {
    await this.tags.remove(await this.findOne(id));
  }

  /** Devuelve las etiquetas pedidas o falla si alguna no existe. */
  async findByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    const found = await this.tags.findBy({ id: In(ids) });
    if (found.length !== new Set(ids).size) {
      throw new NotFoundException('Una o más etiquetas no existen');
    }
    return found;
  }

  private async findOne(id: string): Promise<Tag> {
    const tag = await this.tags.findOneBy({ id });
    if (!tag) throw new NotFoundException(`Etiqueta ${id} no encontrada`);
    return tag;
  }

  private async ensureNameIsFree(name: string): Promise<void> {
    if (await this.tags.existsBy({ name: name.trim() })) {
      throw new ConflictException(`Ya existe una etiqueta llamada "${name.trim()}"`);
    }
  }
}
