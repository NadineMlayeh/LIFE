import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
/*
  `bcryptjs`, not `bcrypt`.

  The native `bcrypt` compiles a binary during install, and serverless hosts increasingly
  refuse to run package install scripts — which turns a missing build step into a crash on
  every login, at runtime, in production. The pure-JavaScript implementation has no build step
  and cannot fail that way.

  It is slower, which does not matter at this scale, and it produces and verifies the **same
  standard bcrypt hashes** — so passwords created before this change still work.
*/
import bcrypt from 'bcryptjs';
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly books: BooksService,
  ) {}

  async signup(
    email: string,
    username: string,
    password: string,
  ): Promise<{ message: string; delivered: boolean }> {
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

    const delivered = await this.sendVerificationToken(user.id, user.email);

    /*
      The account is created either way.

      If the letter could not be posted, saying so is the only honest answer: the registration
      genuinely succeeded, and asking for another letter is genuinely the next step. Failing
      the whole request instead would leave an account nobody was told about, reachable only
      by registering the same address again.
    */
    return {
      message: delivered
        ? 'Check your email for a verification link.'
        : 'Your account was created, but the letter could not be sent just now.',
      delivered,
    };
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

    /*
      Recorded only once the login has actually succeeded, so a wrong password never looks like
      a visit. Deliberately not awaited as part of the response: a bookkeeping write failing is
      no reason to refuse someone entry to their own account.
    */
    this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Could not record the login: ${reason}`);
      });

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

    // Same reasoning as the reset route: the answer must not depend on whether the letter went.
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

    /*
      Delivery failures are swallowed deliberately, and this is the route where it matters
      most. An unknown address returns `sent` above without contacting the provider at all —
      so if a real address could produce an error instead, the difference between the two
      answers would reveal which addresses are registered. That is exactly what the identical
      message exists to prevent.
    */
    const appUrl = process.env.APP_URL ?? 'http://localhost:5173';
    await this.deliver(
      () => this.mail.sendPasswordResetEmail(user.email, `${appUrl}/reset?token=${token}`),
      'password reset',
    );

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

  /** Issues a fresh verification link, and reports whether the letter actually went. */
  private async sendVerificationToken(userId: string, email: string): Promise<boolean> {
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
    return this.deliver(
      () => this.mail.sendVerificationEmail(email, `${appUrl}/verify?token=${token}`),
      'verification',
    );
  }

  /**
   * Posts a letter and reports whether it left, instead of letting the failure escape.
   *
   * Sending mail is the one part of these routes that depends on a service outside this
   * application, and it fails for reasons that have nothing to do with the request: the
   * provider is unreachable, the sending domain is unverified, the recipient is refused. None
   * of those mean the work already done should be undone, and all of them arrive as a plain
   * error that would otherwise surface as a bare 500 — the least informative answer there is.
   *
   * The token is always written before this runs, so a letter that fails to send can still be
   * asked for again and the link in it will work.
   *
   * The reason is logged in full because the server log is the only place it can be read
   * afterwards; it is never returned, since it describes the mail account rather than the
   * caller.
   */
  private async deliver(send: () => Promise<void>, kind: string): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Could not send the ${kind} email: ${reason}`);
      return false;
    }
  }
}
