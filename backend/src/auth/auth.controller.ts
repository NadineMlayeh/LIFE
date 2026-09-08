import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { CurrentUser, type RequestUser } from './current-user.decorator.js';
import { EmailDto } from './dto/email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token ?? '');
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: EmailDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
