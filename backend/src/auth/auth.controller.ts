import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '../common/rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser, type RequestUser } from './current-user.decorator.js';
import { EmailDto } from './dto/email.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto.js';
import { SignupDto } from './dto/signup.dto.js';
import { ChangeUsernameDto } from './dto/username.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Signing up sends an email, so an unlimited route here is a way to post mail at strangers.
  @Throttle(5, 3600)
  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto.email, dto.username, dto.password);
  }

  // The one that matters most: without a cap, passwords can be guessed at machine speed.
  @Throttle(8, 900)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  // Answered without auth: usernames are public handles, so this reveals nothing that trying
  // to register the name would not.
  @Throttle(60, 60)
  @Get('username-available')
  usernameAvailable(@Query('username') username: string) {
    return this.authService.isUsernameAvailable(username ?? '');
  }

  @Get('verify')
  verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token ?? '');
  }

  @Throttle(4, 3600)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: EmailDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Throttle(4, 3600)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Throttle(8, 900)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Patch('username')
  @UseGuards(JwtAuthGuard)
  changeUsername(@CurrentUser() user: RequestUser, @Body() dto: ChangeUsernameDto) {
    return this.authService.changeUsername(user.id, dto.username);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }
}
