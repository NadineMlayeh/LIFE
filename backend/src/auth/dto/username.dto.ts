import { IsString, Matches } from 'class-validator';
import { USERNAME_PATTERN } from './signup.dto.js';

export class ChangeUsernameDto {
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'A username is 3–24 characters, starts with a letter, and uses only letters, numbers and underscores',
  })
  username!: string;
}
