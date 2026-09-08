import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UpdateFileDto } from './dto/file.dto.js';

const MAX_BYTES = 10 * 1024 * 1024;

// Executables and scripts are refused outright — LIFE stores documents, and anything that
// could be handed back to a browser as runnable content is not worth the risk.
const BLOCKED_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.com', '.msi', '.scr', '.ps1',
  '.sh', '.jar', '.js', '.mjs', '.vbs', '.html', '.htm', '.svg',
];

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string, timelineEventId?: string, itemId?: string) {
    return this.prisma.file.findMany({
      where: {
        userId,
        ...(timelineEventId ? { timelineEventId } : {}),
        ...(itemId ? { itemId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    userId: string,
    file: Express.Multer.File,
    links: { timelineEventId?: string; itemId?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_BYTES) throw new BadRequestException('File is larger than 10 MB');

    const lower = file.originalname.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      throw new BadRequestException('That file type is not allowed');
    }

    await this.assertLinksOwned(userId, links);

    const storagePath = await this.storage.saveFile(userId, 'files', file);

    return this.prisma.file.create({
      data: {
        userId,
        storagePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        timelineEventId: links.timelineEventId,
        itemId: links.itemId,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateFileDto) {
    await this.findOwned(userId, id);
    await this.assertLinksOwned(userId, dto);

    return this.prisma.file.update({
      where: { id },
      data: {
        visibility: dto.visibility,
        timelineEventId: dto.timelineEventId,
        itemId: dto.itemId,
      },
    });
  }

  async remove(userId: string, id: string) {
    const file = await this.findOwned(userId, id);
    await this.storage.deleteFile(file.storagePath);
    await this.prisma.file.delete({ where: { id } });
    return { deleted: true };
  }

  async download(userId: string, id: string) {
    const file = await this.findOwned(userId, id);
    const stream = this.storage.getFileStream(file.storagePath);
    if (!stream) throw new NotFoundException('File is missing from storage');
    return { stream, file };
  }

  private async findOwned(userId: string, id: string) {
    const file = await this.prisma.file.findFirst({ where: { id, userId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  private async assertLinksOwned(
    userId: string,
    links: { timelineEventId?: string; itemId?: string },
  ) {
    if (links.timelineEventId) {
      const event = await this.prisma.timelineEvent.findFirst({
        where: { id: links.timelineEventId, userId },
        select: { id: true },
      });
      if (!event) throw new NotFoundException('Timeline event not found');
    }

    if (links.itemId) {
      const item = await this.prisma.item.findFirst({
        where: { id: links.itemId, chapter: { book: { userId } } },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Item not found');
    }
  }
}
