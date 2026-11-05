import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Subtarea enviada por el cliente; sin `id` se crea, con `id` se actualiza. */
export class ChecklistItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  text: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
