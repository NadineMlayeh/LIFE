import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpsertVisitedCountryDto } from './dto/visited-country.dto.js';

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.visitedCountry.findMany({
      where: { userId },
      orderBy: { countryCode: 'asc' },
    });
  }

  // Countries are toggled on and off a map rather than created and edited as records, so the
  // country code is the natural key per user.
  async upsert(userId: string, dto: UpsertVisitedCountryDto) {
    const countryCode = dto.countryCode.toUpperCase();

    const existing = await this.prisma.visitedCountry.findFirst({
      where: { userId, countryCode },
      select: { id: true },
    });

    const data = {
      visitedDate: dto.visitedDate ? new Date(dto.visitedDate) : null,
      notes: dto.notes,
      status: dto.status ?? 'visited',
    };

    if (existing) {
      return this.prisma.visitedCountry.update({ where: { id: existing.id }, data });
    }

    return this.prisma.visitedCountry.create({ data: { userId, countryCode, ...data } });
  }

  async remove(userId: string, countryCode: string) {
    const existing = await this.prisma.visitedCountry.findFirst({
      where: { userId, countryCode: countryCode.toUpperCase() },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Country not found');

    await this.prisma.visitedCountry.delete({ where: { id: existing.id } });
    return { deleted: true };
  }
}
