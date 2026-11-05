import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagsModule } from '../tags/tags.module';
import { ChecklistItem } from './entities/checklist-item.entity';
import { Note } from './entities/note.entity';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Note, ChecklistItem]), TagsModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
