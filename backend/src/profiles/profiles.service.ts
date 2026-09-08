import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrivacyService } from '../privacy/privacy.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly privacy: PrivacyService,
  ) {}

  // The identity record carries its own visibility so the UI can show the true state. The
  // toggle previously assumed "private" and wrote to a setting the shared view never read.
  async get(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) return null;

    const visibility = await this.privacy.getOne(userId, 'PROFILE', userId);
    return { ...profile, visibility };
  }

  async upsert(userId: string, dto: UpdateProfileDto) {
    const data = {
      fullName: dto.fullName,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      birthplace: dto.birthplace,
      nationality: dto.nationality,
      languages: dto.languages,
    };

    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

}
