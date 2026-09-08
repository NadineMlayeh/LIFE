import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.note.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
  }

  async create(userId: string, dto: CreateNoteDto) {
    return this.prisma.note.create({ data: { userId, content: dto.content } });
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    await this.assertOwned(userId, id);
    return this.prisma.note.update({ where: { id }, data: { content: dto.content } });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);
    await this.prisma.note.delete({ where: { id } });
    return { deleted: true };
  }

  private async assertOwned(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({ where: { id, userId }, select: { id: true } });
    if (!note) throw new NotFoundException('Note not found');
  }
}
