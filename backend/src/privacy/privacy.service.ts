import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PrivacyEntityType, StoredVisibility, VisibilityValue } from './dto/privacy.dto.js';

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async set(
    userId: string,
    entityType: PrivacyEntityType,
    entityId: string,
    visibility: VisibilityValue,
  ) {
    await this.assertEntityOwned(userId, entityType, entityId);

    if (entityType === 'PHOTO') {
      return this.prisma.photo.update({ where: { id: entityId }, data: { visibility } });
    }

    return this.prisma.privacySetting.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      create: { entityType, entityId, userId, visibility },
      update: { visibility },
    });
  }

  // Returns a lookup of entityId -> visibility. Anything without a row is PRIVATE, because
  // private is the default and absence of a decision must never mean "shared".
  async getMap(
    userId: string,
    entityType: PrivacyEntityType,
    entityIds: string[],
  ): Promise<Record<string, StoredVisibility>> {
    if (entityIds.length === 0) return {};

    const rows = await this.prisma.privacySetting.findMany({
      where: { userId, entityType, entityId: { in: entityIds } },
    });

    const map: Record<string, StoredVisibility> = {};
    for (const id of entityIds) map[id] = 'PRIVATE';
    for (const row of rows) map[row.entityId] = row.visibility;
    return map;
  }

  private async assertEntityOwned(
    userId: string,
    entityType: PrivacyEntityType,
    entityId: string,
  ) {
    const exists = await this.entityExists(userId, entityType, entityId);
    if (!exists) throw new NotFoundException(`${entityType} not found`);
  }

  private async entityExists(userId: string, entityType: PrivacyEntityType, entityId: string) {
    const select = { id: true };
    switch (entityType) {
      case 'BOOK':
        return this.prisma.book.findFirst({ where: { id: entityId, userId }, select });
      case 'TIMELINE_EVENT':
        return this.prisma.timelineEvent.findFirst({ where: { id: entityId, userId }, select });
      case 'PHOTO':
        return this.prisma.photo.findFirst({ where: { id: entityId, userId }, select });
      // Whole-object switches. There is exactly one map and one identity record per user, so
      // the user's own id is the entity id and owning it is the whole check.
      case 'PROFILE':
      case 'MAP':
        return entityId === userId ? { id: entityId } : null;
    }
  }

  /** Reads a single whole-object switch (`PROFILE`, `MAP`). Absent means PRIVATE. */
  async getOne(
    userId: string,
    entityType: PrivacyEntityType,
    entityId: string,
  ): Promise<StoredVisibility> {
    const row = await this.prisma.privacySetting.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    });
    return row && row.userId === userId ? row.visibility : 'PRIVATE';
  }
}
