import { IsEnum, IsUUID } from 'class-validator';

// MAP, PROFILE and TIMELINE are whole-object switches: there is one of each per user, and its
// `entityId` is the user's own id. Everything else is controlled per record.
//
// NOTE is deliberately absent. The notebook is always private — it is the one place in LIFE
// meant for things you are not showing anyone, so it has no share control at all rather than
// a control that happens to default to off.
export const PRIVACY_ENTITY_TYPES = [
  'BOOK',
  'PHOTO',
  'PROFILE',
  'MAP',
  'TIMELINE',
] as const;
export type PrivacyEntityType = (typeof PRIVACY_ENTITY_TYPES)[number];

// PUBLIC is reserved by the schema for the Phase 7 discovery feature, so it is deliberately
// not accepted as input — but stored rows must still be readable as one of all three.
export const VISIBILITIES = ['PRIVATE', 'SHARE_ONLY'] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export type StoredVisibility = VisibilityValue | 'PUBLIC';

export class SetPrivacyDto {
  @IsEnum(PRIVACY_ENTITY_TYPES)
  entityType!: PrivacyEntityType;

  @IsUUID()
  entityId!: string;

  @IsEnum(VISIBILITIES)
  visibility!: VisibilityValue;
}
