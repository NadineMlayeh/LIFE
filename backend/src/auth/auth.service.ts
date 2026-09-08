import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { BooksService } from '../books/books.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SALT_ROUNDS = 10;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly books: BooksService,
  ) {}

  async signup(email: string, password: string): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing?.emailVerified) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // An unverified registration is not yet owned by anyone, so re-signing up
    // with the same address replaces it rather than locking the address forever.
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : await this.prisma.user.create({ data: { email, passwordHash } });

    await this.sendVerificationToken(user.id, user.email);

    return { message: 'Check your email for a verification link.' };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email address before logging in');
    }

    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const bookCount = await this.prisma.book.count({ where: { userId: record.userId } });
    if (bookCount === 0) {
      await this.books.seedDefaults(record.userId);
    }

    return { message: 'Email verified. You can now log in.' };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.emailVerified) {
      await this.sendVerificationToken(user.id, user.email);
    }

    return { message: 'If that account exists and is unverified, a new link has been sent.' };
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  private async sendVerificationToken(userId: string, email: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      },
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    await this.mail.sendVerificationEmail(email, `${appUrl}/verify?token=${token}`);
  }
}
