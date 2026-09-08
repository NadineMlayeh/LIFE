import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateChapterDto {
  @IsUUID()
  bookId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;
}

export class UpdateChapterDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
