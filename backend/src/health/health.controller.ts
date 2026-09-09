import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * A cheap route whose real job is to be called before anybody needs anything.
 *
 * On free serverless hosting there is no process between requests and the database sleeps when
 * idle, so the first request after a quiet spell pays for both waking up. That cost cannot be
 * removed on this kind of plan — but it can be moved somewhere nobody is waiting.
 *
 * The frontend is static files on a CDN and appears instantly, so it calls this the moment it
 * loads. The function boots and the database wakes while a visitor is still reading the login
 * card, and by the time they have finished typing, the request that actually matters lands on
 * something already warm.
 *
 * **It has to touch the database**, which is the point of the query below. Waking only the
 * function would leave the slower half of the problem untouched.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();

    let database: 'up' | 'down' = 'up';
    try {
      // The cheapest statement there is. Nothing is read; the round trip is the whole purpose.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }

    return { status: database === 'up' ? 'ok' : 'degraded', database, ms: Date.now() - startedAt };
  }
}
