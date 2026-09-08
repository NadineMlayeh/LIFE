import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const VISIBILITIES = ['PRIVATE', 'SHARE_ONLY', 'PUBLIC'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export class UpdatePhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;

  @IsOptional()
  @IsEnum(VISIBILITIES)
  visibility?: VisibilityValue;

  // The photo shown in the room's wall frame. Setting it clears the previous one.
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsUUID()
  timelineEventId?: string;
}
