import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** An email address or a username — people remember whichever they last typed. */
  @IsString()
  @MinLength(1)
  @MaxLength(320)
  identifier!: string;

  @IsString()
  password!: string;
}
