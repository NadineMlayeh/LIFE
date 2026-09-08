import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Letters, digits and underscores, starting with a letter. Deliberately narrow: a handle that
 * people type, read aloud and put in a URL should not contain anything ambiguous.
 */
export const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,23}$/;

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(USERNAME_PATTERN, {
    message:
      'A username is 3–24 characters, starts with a letter, and uses only letters, numbers and underscores',
  })
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}
