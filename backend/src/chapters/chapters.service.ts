import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto.js';

@Injectable()
export class ChaptersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateChapterDto) {
    const book = await this.prisma.book.findFirst({
      where: { id: dto.bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const last = await this.prisma.chapter.findFirst({
      where: { bookId: dto.bookId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return this.prisma.chapter.create({
      data: { bookId: dto.bookId, title: dto.title, order: (last?.order ?? -1) + 1 },
    });
  }

  async update(userId: string, id: string, dto: UpdateChapterDto) {
    await this.assertOwned(userId, id);
    return this.prisma.chapter.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.chapter.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id, book: { userId } },
      select: { id: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
  }
}
