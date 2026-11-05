import { IsHexColor, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}
