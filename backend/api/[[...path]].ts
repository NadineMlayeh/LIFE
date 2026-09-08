import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { AppModule } from '../src/app.module.js';
import { RateLimitGuard } from '../src/common/rate-limit.guard.js';
import { securityHeaders } from '../src/common/security-headers.js';

/**
 * The serverless entry point.
 *
 * `src/main.ts` starts a long-running server, which is what runs locally. In production the API
 * is a **function**: the host wakes a copy, hands it one request, and may discard it straight
 * afterwards. There is no process sitting there between calls, which is exactly why hosting it
 * costs nothing.
 *
 * Two consequences shape this file.
 *
 * **The Nest app is built once and kept.** Bootstrapping means reading every module and opening
 * a database connection; doing it per request would add hundreds of milliseconds to all of
 * them. The promise is cached at module scope, so a warm copy reuses it and only a cold start
 * pays. Caching the *promise* rather than the app also means two requests arriving together
 * during a cold start wait on one bootstrap instead of racing to run two.
 *
 * **The instance is temporary.** Nothing may be kept in memory that matters — which is why
 * photographs go to object storage rather than disk, and why the rate limiter's counters are
 * documented as per-instance rather than global.
 */
let cached: Promise<NestExpressApplication> | null = null;

async function bootstrap(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The platform already captures stdout; Nest's own banner adds noise to every cold start.
    logger: ['error', 'warn'],
  });

  app.use(securityHeaders);
  app.set('trust proxy', 1);
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(new RateLimitGuard(app.get(Reflector)));

  await app.init();
  return app;
}

export default async function handler(req: Request, res: Response) {
  cached ??= bootstrap();
  const app = await cached;

  /*
    Strip the `/api` prefix before Express sees the request.

    Every path is rewritten to `/api/<path>` so that a single catch-all function handles the
    whole API — but Nest's routes are declared without that prefix (`/auth/login`, not
    `/api/auth/login`). Left in place, every request would 404.

    A rewrite that collapsed to a fixed `/api` would be worse still: the original path would be
    gone entirely and unrecoverable, so nothing could be routed at all.
  */
  if (req.url?.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  }

  // Hand it to Nest's underlying Express instance and let it route as normal.
  app.getHttpAdapter().getInstance()(req, res);
}
