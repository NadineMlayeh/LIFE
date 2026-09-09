import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { UpdatePhotoDto } from './dto/photo.dto.js';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
/*
  Four megabytes, not five, and the number is not arbitrary.

  A serverless request body is capped by the platform — Vercel's limit is 4.5 MB — and that cap
  is enforced before any of this code runs, so a file between the two limits would be rejected
  by the host with an opaque error instead of by us with a sentence saying what was wrong.
  Staying underneath means every refusal is one we can explain.

  The browser compresses to a few hundred kilobytes before uploading, so this is a backstop for
  the API being called directly, and for the one format compression declines to touch: an
  animated GIF is passed through untouched, since re-encoding it to JPEG would flatten it to a
  single frame.
*/
const MAX_BYTES = 4 * 1024 * 1024;

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string, timelineEventId?: string) {
    return this.prisma.photo.findMany({
      where: { userId, ...(timelineEventId ? { timelineEventId } : {}) },
      // Oldest first: an album is read forwards, and the earliest page should be the earliest
      // photograph.
      orderBy: { createdAt: 'asc' },
    });
  }

  async upload(userId: string, file: Express.Multer.File, caption?: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image is larger than 4 MB');
    }

    const storagePath = await this.storage.saveFile(userId, 'gallery', file);

    return this.prisma.photo.create({
      data: {
        userId,
        storagePath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        caption,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdatePhotoDto) {
    await this.findOwned(userId, id);
    await this.assertLinksOwned(userId, dto);

    // Exactly one photo can be featured, so promoting one demotes the rest.
    if (dto.isFeatured) {
      await this.prisma.photo.updateMany({
        where: { userId, isFeatured: true },
        data: { isFeatured: false },
      });
    }

    return this.prisma.photo.update({
      where: { id },
      data: {
        caption: dto.caption,
        visibility: dto.visibility,
        isFeatured: dto.isFeatured,
        timelineEventId: dto.timelineEventId,
      },
    });
  }

  // The room's wall frame needs one photo without loading the whole gallery.
  async getFeatured(userId: string) {
    const featured = await this.prisma.photo.findFirst({
      where: { userId, isFeatured: true },
    });
    if (featured) return featured;

    return this.prisma.photo.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  private async assertLinksOwned(userId: string, dto: UpdatePhotoDto) {
    if (dto.timelineEventId) {
      const event = await this.prisma.timelineEvent.findFirst({
        where: { id: dto.timelineEventId, userId },
        select: { id: true },
      });
      if (!event) throw new NotFoundException('Timeline event not found');
    }
  }

  async remove(userId: string, id: string) {
    const photo = await this.findOwned(userId, id);
    await this.storage.deleteFile(photo.storagePath);
    await this.prisma.photo.delete({ where: { id } });
    return { deleted: true };
  }

  async getFile(userId: string, id: string) {
    const photo = await this.findOwned(userId, id);
    const stream = await this.storage.getFileStream(photo.storagePath);
    if (!stream) throw new NotFoundException('Image file is missing from storage');
    return { stream, mimeType: photo.mimeType };
  }

  private async findOwned(userId: string, id: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id, userId } });
    if (!photo) throw new NotFoundException('Photo not found');
    return photo;
  }
}
