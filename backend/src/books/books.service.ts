import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { CreateBookDto, UpdateBookDto } from './dto/book.dto.js';

export const DEFAULT_BOOKS = [
  { title: 'Family', icon: '👪' },
  { title: 'Career', icon: '💼' },
  { title: 'Education', icon: '🎓' },
  { title: 'Relationships', icon: '💛' },
  { title: 'Health', icon: '🌿' },
  { title: 'Travel', icon: '🧭' },
  { title: 'Hobbies', icon: '🎠' },
  { title: 'Achievements', icon: '🏆' },
  { title: 'Places', icon: '📍' },
  { title: 'Finance', icon: '📈' },
  { title: 'Personal Development', icon: '🌱' },
];

@Injectable()
export class BooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
  ) {}

  async seedDefaults(userId: string) {
    await this.prisma.book.createMany({
      data: DEFAULT_BOOKS.map((book) => ({ ...book, userId, isCustom: false })),
    });
  }

  async list(userId: string, includeHidden: boolean) {
    const books = await this.prisma.book.findMany({
      where: { userId, ...(includeHidden ? {} : { isHidden: false }) },
      orderBy: [{ isCustom: 'asc' }, { title: 'asc' }],
      include: { _count: { select: { chapters: true } } },
    });

    const visibility = await this.privacy.getMap(
      userId,
      'BOOK',
      books.map((book) => book.id),
    );

    return books.map((book) => ({ ...book, visibility: visibility[book.id] }));
  }

  async findOne(userId: string, id: string) {
    const book = await this.prisma.book.findFirst({
      where: { id, userId },
      include: {
        chapters: {
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });

    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async create(userId: string, dto: CreateBookDto) {
    return this.prisma.book.create({
      data: { userId, title: dto.title, icon: dto.icon, isCustom: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateBookDto) {
    await this.assertOwned(userId, id);
    return this.prisma.book.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.book.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const book = await this.prisma.book.findFirst({ where: { id, userId }, select: { id: true } });
    if (!book) throw new NotFoundException('Book not found');
  }
}
