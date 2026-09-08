import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const GOAL_STATUSES = ['PENDING', 'ACHIEVED', 'NOT_ACHIEVED', 'RESCHEDULED'] as const;
export type GoalStatusValue = (typeof GOAL_STATUSES)[number];

export class CreateTimelineEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

  @IsOptional()
  @IsUUID()
  bookId?: string;

  @IsOptional()
  @IsBoolean()
  isGoal?: boolean;
}

export class UpdateTimelineEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

  @IsOptional()
  @IsUUID()
  bookId?: string;

  @IsOptional()
  @IsBoolean()
  isGoal?: boolean;

  @IsOptional()
  @IsEnum(GOAL_STATUSES)
  goalStatus?: GoalStatusValue;
}
