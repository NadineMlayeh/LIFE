import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { USERNAME_PATTERN } from '../../auth/dto/signup.dto.js';

export class SendLetterDto {
  /**
   * The recipient's username, not their email. A letter is addressed to a person as other
   * people know them; requiring an email address would mean you could only write to someone
   * whose address you already had, which is exactly what usernames exist to avoid.
   */
  @IsString()
  @Matches(USERNAME_PATTERN, { message: 'That is not a valid username' })
  recipient!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  /**
   * Enclose an invitation to the writer's own room. The server picks or creates the share
   * link itself — the sender never handles a token, so there is no copying a link out of one
   * place and pasting it into another.
   */
  @IsOptional()
  @IsBoolean()
  enclose?: boolean;
}
