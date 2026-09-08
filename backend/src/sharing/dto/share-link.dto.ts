import { IsIn, IsOptional } from 'class-validator';

/**
 * How long a key lasts. A short list rather than a free number: these are the only spans that
 * mean anything in practice, and `'never'` is a decision worth making deliberately rather
 * than by typing a large figure.
 */
export const KEY_LIFESPANS = ['7', '30', '365', 'never'] as const;
export type KeyLifespan = (typeof KEY_LIFESPANS)[number];

export class CreateShareLinkDto {
  @IsOptional()
  @IsIn(KEY_LIFESPANS)
  lifespan?: KeyLifespan;
}
