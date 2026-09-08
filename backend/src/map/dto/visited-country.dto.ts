import { IsDateString, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export const COUNTRY_STATUSES = ['visited', 'future'] as const;
export type CountryStatus = (typeof COUNTRY_STATUSES)[number];

export class UpsertVisitedCountryDto {
  // ISO 3166-1 alpha-2, so the frontend can key any map library off it later.
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @IsOptional()
  @IsDateString()
  visitedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsIn(COUNTRY_STATUSES)
  status?: CountryStatus;
}
