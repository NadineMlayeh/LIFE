import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { RateLimitGuard } from './common/rate-limit.guard.js';
import { securityHeaders } from './common/security-headers.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Security headers, before anything else.
  app.use(securityHeaders);

  /*
    Behind a proxy — Vercel, Render, any CDN — the socket address is the proxy's, not the
    caller's. Trusting the proxy makes Express read the real address from `x-forwarded-for`,
    which is what the rate limiter counts against. Without this every visitor would share one
    bucket and the limits would lock out the whole site at once.
  */
  app.set('trust proxy', 1);

  // Only the frontend may call the API from a browser. Anything else is refused by CORS.
  app.enableCors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' });

  /*
    `whitelist` strips any property a DTO does not declare, so a request cannot smuggle in
    fields the code never meant to accept — someone POSTing `emailVerified: true` to signup,
    for instance. `transform` turns plain JSON into the DTO class so validation decorators run.
  */
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Applied globally, but only bites on routes marked with @Throttle.
  app.useGlobalGuards(new RateLimitGuard(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
