import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
  ) {}

  async listLinks(userId: string) {
    return this.prisma.shareLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLink(userId: string) {
    // 32 random bytes, not a sequential id — the token is the only thing standing between
    // the outside world and this content.
    const token = randomBytes(32).toString('hex');
    return this.prisma.shareLink.create({ data: { userId, token } });
  }

  async revokeLink(userId: string, id: string) {
    const link = await this.prisma.shareLink.findFirst({ where: { id, userId } });
    if (!link) throw new NotFoundException('Share link not found');

    return this.prisma.shareLink.update({ where: { id }, data: { revoked: true } });
  }

  // The only entry point for unauthenticated readers. Everything it returns has been
  // filtered to SHARE_ONLY content by the database query itself — private rows are never
  // loaded, so they cannot leak through a serialisation mistake later.
  async getSharedView(token: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { token } });
    if (!link || link.revoked) {
      throw new NotFoundException('This share link is not valid');
    }

    const userId = link.userId;

    const sharedIds = async (entityType: string) => {
      const rows = await this.prisma.privacySetting.findMany({
        where: { userId, entityType, visibility: 'SHARE_ONLY' },
        select: { entityId: true },
      });
      return rows.map((row) => row.entityId);
    };

    const [bookIds, eventIds] = await Promise.all([
      sharedIds('BOOK'),
      sharedIds('TIMELINE_EVENT'),
    ]);

    const [books, events, photos, profileRow, profileVisible, mapVisible, featuredPhoto] =
      await Promise.all([
      this.prisma.book.findMany({
        where: { id: { in: bookIds }, userId },
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          icon: true,
          chapters: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              items: {
                orderBy: { createdAt: 'asc' },
                select: { id: true, type: true, title: true, body: true, itemDate: true },
              },
            },
          },
        },
      }),
      this.prisma.timelineEvent.findMany({
        where: { id: { in: eventIds }, userId },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          title: true,
          date: true,
          description: true,
          isGoal: true,
          goalStatus: true,
          book: { select: { id: true, title: true, icon: true } },
        },
      }),
      this.prisma.photo.findMany({
        where: { userId, visibility: 'SHARE_ONLY' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, caption: true, mimeType: true },
      }),
      this.prisma.profile.findUnique({ where: { userId } }),
      // Whole-object switches: identity and the map are each all-or-nothing.
      this.privacy.getOne(userId, 'PROFILE', userId),
      this.privacy.getOne(userId, 'MAP', userId),
      // The featured photo is deliberately public — it behaves like a profile picture, so it
      // is the one thing a visitor always sees.
      this.prisma.photo.findFirst({
        where: { userId, isFeatured: true },
        select: { id: true, caption: true, mimeType: true },
      }),
    ]);

    // Identity is all-or-nothing: the mirror is shared as a whole or not at all.
    const profile =
      profileVisible === 'SHARE_ONLY' && profileRow
        ? {
            fullName: profileRow.fullName,
            dob: profileRow.dob,
            birthplace: profileRow.birthplace,
            nationality: profileRow.nationality,
            languages: profileRow.languages,
          }
        : null;

    // The map is likewise a single switch; when it is private the visitor gets no countries
    // at all, and the map object simply does not open for them.
    const visitedCountries =
      mapVisible === 'SHARE_ONLY'
        ? await this.prisma.visitedCountry.findMany({
            where: { userId },
            orderBy: { countryCode: 'asc' },
            select: { id: true, countryCode: true, visitedDate: true, notes: true, status: true },
          })
        : [];

    return {
      profile,
      books,
      events,
      photos,
      visitedCountries,
      mapShared: mapVisible === 'SHARE_ONLY',
      featuredPhoto,
    };
  }

  // Photos are served through their own route, so it needs the same token check rather than
  // trusting that the caller already fetched the shared view.
  async getSharedPhoto(token: string, photoId: string) {
    const link = await this.prisma.shareLink.findUnique({ where: { token } });
    if (!link || link.revoked) throw new NotFoundException('This share link is not valid');

    // Shared photos, plus the featured one, which is public by design.
    const photo = await this.prisma.photo.findFirst({
      where: {
        id: photoId,
        userId: link.userId,
        OR: [{ visibility: 'SHARE_ONLY' }, { isFeatured: true }],
      },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    return photo;
  }
}
