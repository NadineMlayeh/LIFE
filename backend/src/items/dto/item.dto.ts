import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const ITEM_TYPES = [
  'PERSON',
  'PLACE',
  'MEMORY',
  'EVENT',
  'ACHIEVEMENT',
  'NOTE',
  'FILE',
  'PHOTO',
  'CUSTOM',
] as const;

export type ItemTypeValue = (typeof ITEM_TYPES)[number];

export class CreateItemDto {
  @IsUUID()
  chapterId!: string;

  @IsEnum(ITEM_TYPES)
  type!: ItemTypeValue;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsDateString()
  itemDate?: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsEnum(ITEM_TYPES)
  type?: ItemTypeValue;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsDateString()
  itemDate?: string;
}
