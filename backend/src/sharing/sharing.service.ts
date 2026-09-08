import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import type { KeyLifespan } from './dto/share-link.dto.js';

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

  /**
   * Cuts a key.
   *
   * Most keys are for one person and should lapse on their own — a link that never expires is
   * one you have to remember to take back, and forgotten keys are how things quietly stay
   * shared for years. But a key posted publicly is a different object: it is meant to outlive
   * the moment, and having it die silently three weeks after a post would be worse than the
   * risk it carries. So `'never'` exists, deliberately, as a choice rather than a default.
   */
  async createLink(userId: string, lifespan: KeyLifespan = '30') {
    // 32 random bytes, not a sequential id — the token is the only thing standing between
    // the outside world and this content.
    const token = randomBytes(32).toString('hex');
    const expiresAt =
      lifespan === 'never'
        ? null
        : new Date(Date.now() + Number(lifespan) * 24 * 60 * 60 * 1000);
    return this.prisma.shareLink.create({ data: { userId, token, expiresAt } });
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
    if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) {
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

    const bookIds = await sharedIds('BOOK');

    // A visitor is standing in someone's room, so they should know whose. The username is the
    // public handle and the only identifier ever exposed here — never the email.
    const owner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    /*
      The whole-object switches are read FIRST, and the content behind them is only queried if
      it is actually shared.

      This used to fetch every timeline event and the whole profile in the same parallel batch,
      then discard them in JavaScript when the switch turned out to be private — which quietly
      broke the rule this method is built on. Private rows must never be loaded at all: as long
      as they are in memory, some later change to how the response is assembled can leak them.
      One extra round trip is a cheap price for the guarantee being true rather than intended.
    */
    const [profileVisible, mapVisible, timelineVisible] = await Promise.all([
      this.privacy.getOne(userId, 'PROFILE', userId),
      this.privacy.getOne(userId, 'MAP', userId),
      this.privacy.getOne(userId, 'TIMELINE', userId),
    ]);

    const [books, events, photos, profileRow, visitedCountries, featuredPhoto] = await Promise.all([
      this.prisma.book.findMany({
        where: { id: { in: bookIds }, userId },
        orderBy: { title: 'asc' },
        select: {
          id: true,
          title: true,
          icon: true,
          chapters: {
            orderBy: { order: 'asc' },
            select: { id: true, title: true, content: true },
          },
        },
      }),

      // Shared entire, or not at all — and if not, never read.
      timelineVisible === 'SHARE_ONLY'
        ? this.prisma.timelineEvent.findMany({
            where: { userId },
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
          })
        : [],

      this.prisma.photo.findMany({
        where: { userId, visibility: 'SHARE_ONLY' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, caption: true, mimeType: true },
      }),

      profileVisible === 'SHARE_ONLY'
        ? this.prisma.profile.findUnique({ where: { userId } })
        : null,

      mapVisible === 'SHARE_ONLY'
        ? this.prisma.visitedCountry.findMany({
            where: { userId },
            orderBy: { countryCode: 'asc' },
            select: {
              id: true,
              countryCode: true,
              visitedDate: true,
              notes: true,
              status: true,
            },
          })
        : [],

      // The featured photograph is deliberately public — it behaves like a profile picture,
      // so it is the one thing a visitor always sees.
      this.prisma.photo.findFirst({
        where: { userId, isFeatured: true },
        select: { id: true, caption: true, mimeType: true },
      }),
    ]);

    // Identity is all-or-nothing: the mirror is shared as a whole or not at all.
    const profile = profileRow
      ? {
          fullName: profileRow.fullName,
          dob: profileRow.dob,
          birthplace: profileRow.birthplace,
          nationality: profileRow.nationality,
          languages: profileRow.languages,
        }
      : null;

    return {
      owner: { username: owner?.username ?? 'someone' },
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
    if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) {
      throw new NotFoundException('This share link is not valid');
    }

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
