import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { CreateTimelineEventDto, UpdateTimelineEventDto } from './dto/timeline.dto.js';

@Injectable()
export class TimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
  ) {}

  async list(userId: string, search?: string) {
    const events = await this.prisma.timelineEvent.findMany({
      where: {
        userId,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { date: 'asc' },
      include: { book: { select: { id: true, title: true, icon: true } } },
    });

    const visibility = await this.privacy.getMap(
      userId,
      'TIMELINE_EVENT',
      events.map((event) => event.id),
    );

    return events.map((event) => ({ ...event, visibility: visibility[event.id] }));
  }

  async findOne(userId: string, id: string) {
    const event = await this.prisma.timelineEvent.findFirst({
      where: { id, userId },
      include: { book: { select: { id: true, title: true, icon: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async create(userId: string, dto: CreateTimelineEventDto) {
    await this.assertBookOwned(userId, dto.bookId);

    return this.prisma.timelineEvent.create({
      data: {
        userId,
        title: dto.title,
        date: new Date(dto.date),
        description: dto.description,
        type: dto.type,
        bookId: dto.bookId,
        isGoal: dto.isGoal ?? false,
        goalStatus: dto.isGoal ? 'PENDING' : null,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateTimelineEventDto) {
    await this.assertOwned(userId, id);
    await this.assertBookOwned(userId, dto.bookId);

    return this.prisma.timelineEvent.update({
      where: { id },
      data: {
        title: dto.title,
        date: dto.date ? new Date(dto.date) : undefined,
        description: dto.description,
        type: dto.type,
        bookId: dto.bookId,
        isGoal: dto.isGoal,
        goalStatus: dto.goalStatus,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.timelineEvent.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const event = await this.prisma.timelineEvent.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');
  }

  private async assertBookOwned(userId: string, bookId?: string) {
    if (!bookId) return;
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');
  }
}
