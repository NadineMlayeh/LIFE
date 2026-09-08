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

  restoreOriginalPath(req);

  // Hand it to Nest's underlying Express instance and let it route as normal.
  app.getHttpAdapter().getInstance()(req, res);
}

/**
 * Puts the path the caller actually asked for back on the request.
 *
 * Every request is rewritten to `/api?__path=<original>` so that one plain function serves the
 * whole API. Nest's routes are declared without any prefix (`/auth/login`), so the original
 * path has to be restored before Express sees it or nothing matches.
 *
 * **Why a query parameter rather than a catch-all file.** Vercel's bracket filenames are a
 * convention, and this project got burnt by it: `[...path]` was read as a dynamic segment
 * *named* `...path` rather than as a catch-all, so one-segment routes reached the app and
 * everything deeper returned a platform 404 — `/books` answered while `/auth/login` did not.
 * Carrying the path in a parameter we set and read ourselves depends on no convention at all.
 */
function restoreOriginalPath(req: Request) {
  const [, rawQuery = ''] = (req.url ?? '').split('?');
  const params = new URLSearchParams(rawQuery);

  const original = params.get('__path');
  if (original === null) return;

  // Anything else on the query belongs to the caller and must survive.
  params.delete('__path');
  const rest = params.toString();

  const path = original.startsWith('/') ? original : `/${original}`;
  req.url = rest ? `${path}?${rest}` : path;
}
