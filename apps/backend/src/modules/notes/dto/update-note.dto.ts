import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateNoteDto } from './create-note.dto';

/** Actualización parcial: solo se modifican los campos enviados. */
export class UpdateNoteDto extends PartialType(CreateNoteDto) {
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
