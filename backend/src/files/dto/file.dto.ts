import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export const VISIBILITIES = ['PRIVATE', 'SHARE_ONLY'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export class UpdateFileDto {
  @IsOptional()
  @IsEnum(VISIBILITIES)
  visibility?: VisibilityValue;

  @IsOptional()
  @IsUUID()
  timelineEventId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}
