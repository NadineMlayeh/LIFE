import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto.js';

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateItemDto) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: dto.chapterId, book: { userId } },
      select: { id: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    return this.prisma.item.create({
      data: {
        chapterId: dto.chapterId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        itemDate: dto.itemDate ? new Date(dto.itemDate) : undefined,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateItemDto) {
    await this.assertOwned(userId, id);
    return this.prisma.item.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        itemDate: dto.itemDate ? new Date(dto.itemDate) : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.item.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const item = await this.prisma.item.findFirst({
      where: { id, chapter: { book: { userId } } },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Item not found');
  }
}
