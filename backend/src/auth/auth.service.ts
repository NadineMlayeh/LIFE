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
// An hour is deliberately short: a reset link is a live key to the account.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; username: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly books: BooksService,
  ) {}

  async signup(email: string, username: string, password: string): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing?.emailVerified) {
      throw new ConflictException('Email is already in use');
    }

    // The handle is taken if anyone else holds it, case-insensitively — `Nadine` and `nadine`
    // must not be two different people.
    const usernameLower = username.toLowerCase();
    const handleTaken = await this.prisma.user.findFirst({
      where: { usernameLower, NOT: existing ? { id: existing.id } : undefined },
      select: { id: true },
    });
    if (handleTaken) {
      throw new ConflictException('That username is taken');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // An unverified registration is not yet owned by anyone, so re-signing up
    // with the same address replaces it rather than locking the address forever.
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, username, usernameLower },
        })
      : await this.prisma.user.create({ data: { email, username, usernameLower, passwordHash } });

    await this.sendVerificationToken(user.id, user.email);

    return { message: 'Check your email for a verification link.' };
  }

  /**
   * Changes the public handle. Deliberately not permanent — a name chosen years ago should not
   * be a life sentence. Uniqueness is enforced case-insensitively, and the old handle is freed
   * immediately, which is the accepted trade for letting people rename at all.
   */
  async changeUsername(userId: string, username: string) {
    const usernameLower = username.toLowerCase();

    const taken = await this.prisma.user.findFirst({
      where: { usernameLower, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      throw new ConflictException('That username is taken');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { username, usernameLower },
      select: { id: true, email: true, username: true },
    });
    return user;
  }

  /**
   * Whether a handle is free. Usernames are public by design, so answering this is not a leak
   * — it is the same thing you learn by trying to register one.
   */
  async isUsernameAvailable(username: string, forUserId?: string) {
    const taken = await this.prisma.user.findFirst({
      where: {
        usernameLower: username.toLowerCase(),
        ...(forUserId ? { NOT: { id: forUserId } } : {}),
      },
      select: { id: true },
    });
    return { available: !taken };
  }

  async login(identifier: string, password: string): Promise<AuthResult> {
    // Either handle works. The failure message stays identical for a missing account and a
    // wrong password, so this cannot be used to discover which addresses are registered.
    const lookup = identifier.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lookup.toLowerCase() }, { usernameLower: lookup.toLowerCase() }],
      },
    });
    if (!user) {
      throw new UnauthorizedException('Those details do not match an account');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Those details do not match an account');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email address before logging in');
    }

    return {
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, username: user.username },
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

  /**
   * Starts a password reset.
   *
   * **Always reports success, even when no such account exists.** Saying "no account with that
   * email" here would turn the form into a way of testing whether an address is registered —
   * and unlike a username, an email address is private. The cost is that a typo looks like a
   * success; the alternative leaks every address anyone cares to try.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const sent = { message: 'If that address has an account, a reset link is on its way.' };

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user || !user.emailVerified) return sent;

    // Any earlier reset link stops working the moment a new one is asked for, so a forwarded
    // or intercepted old email is worthless.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    await this.mail.sendPasswordResetEmail(user.email, `${appUrl}/reset?token=${token}`);

    return sent;
  }

  /** Finishes a reset. The token is single-use and short-lived; using it burns it. */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: 'Your password has been changed. You can log in with it now.' };
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
