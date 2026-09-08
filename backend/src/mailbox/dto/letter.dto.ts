import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendLetterDto {
  @IsEmail()
  recipientEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;
}
