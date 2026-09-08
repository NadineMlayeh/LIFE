import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * A rate limit: how many times one caller may hit a route within a window.
 *
 * Without one, an attacker can try passwords as fast as their machine allows — thousands a
 * minute until one works. A limit turns a lock into a lock that cannot be picked at speed. It
 * also stops the signup and "resend" routes being used to post verification mail at strangers.
 */
export interface RateLimit {
  /** Attempts allowed inside the window. */
  limit: number;
  /** Length of the window, in seconds. */
  windowSeconds: number;
}

export const RATE_LIMIT_KEY = 'rate-limit';

/** Put this on a controller method to limit it. Routes without it are not limited. */
export const Throttle = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds } satisfies RateLimit);

interface Bucket {
  count: number;
  /** When the current window ends, as a millisecond timestamp. */
  resetAt: number;
}

/**
 * A fixed-window counter, held in memory.
 *
 * How it works: each caller gets a bucket per route. The first request opens a window and
 * starts counting; later requests inside that window increment it. Past the limit, the request
 * is refused with 429 until the window expires and the bucket resets.
 *
 * **In memory, which is a real limitation and a deliberate trade.** Buckets live in this
 * process, so they are lost on restart and are not shared between instances — run two copies
 * of the API and a caller gets the limit twice over. For a single small instance that is fine,
 * and it costs no extra service. A deployment that scales past one instance should move this
 * to Redis; the guard's shape would not change, only where the bucket is read from.
 *
 * Written rather than installed because `@nestjs/throttler` does not support NestJS 12 — its
 * peer range stops at 11 — and forcing an unsupported version of an auth-critical dependency
 * is worse than sixty lines of our own.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  /** Stops the map growing without bound on a long-running process. */
  private lastSweep = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RateLimit | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Unlimited by default: only routes that ask for a limit get one.
    if (!rule) return true;

    const request = context.switchToHttp().getRequest();
    const key = `${this.callerOf(request)}:${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();

    this.sweep(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowSeconds * 1000 });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > rule.limit) {
      const seconds = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        `Too many attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Who is calling. Behind a proxy (Vercel, Render, any CDN) the socket address is the
   * proxy's, so the caller's real address arrives in `x-forwarded-for` — first entry, since
   * each hop appends its own.
   */
  private callerOf(request: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  }): string {
    const forwarded = request.headers?.['x-forwarded-for'];
    const header = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (header) return header.split(',')[0].trim();
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }

  /** Drop expired buckets occasionally, so memory tracks active callers rather than all ever. */
  private sweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
