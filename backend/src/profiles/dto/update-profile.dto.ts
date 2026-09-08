import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const VISIBILITIES = ['PRIVATE', 'SHARE_ONLY'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export const PROFILE_FIELDS = [
  'fullName',
  'dob',
  'birthplace',
  'nationality',
  'languages',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export class SetFieldVisibilityDto {
  @IsEnum(PROFILE_FIELDS)
  field!: ProfileField;

  @IsEnum(VISIBILITIES)
  visibility!: VisibilityValue;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  birthplace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  languages?: string;
}
