import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendLetterDto } from './dto/letter.dto.js';

// A letter carries only the correspondent's public handle — never their email, never their
// user id, and nothing else of theirs.
const LETTER_FIELDS = {
  id: true,
  subject: true,
  body: true,
  shareToken: true,
  readAt: true,
  createdAt: true,
  sender: { select: { username: true } },
  recipient: { select: { username: true } },
} as const;

@Injectable()
export class MailboxService {
  constructor(private readonly prisma: PrismaService) {}

  async inbox(userId: string) {
    return this.prisma.letter.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      select: LETTER_FIELDS,
    });
  }

  async sent(userId: string) {
    return this.prisma.letter.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
      select: LETTER_FIELDS,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.letter.count({
      where: { recipientId: userId, readAt: null },
    });
    return { count };
  }

  async send(userId: string, dto: SendLetterDto) {
    const recipient = await this.prisma.user.findFirst({
      where: { usernameLower: dto.recipient.toLowerCase() },
      select: { id: true, emailVerified: true },
    });

    // Saying plainly that nobody holds this username is not a leak: a username is public by
    // design, and you learn the same thing by trying to register it. Silently dropping a
    // letter someone expects to be delivered is the far worse failure.
    if (!recipient || !recipient.emailVerified) {
      throw new NotFoundException('Nobody here goes by that name');
    }

    if (recipient.id === userId) {
      throw new BadRequestException('You cannot send a letter to yourself');
    }

    return this.prisma.letter.create({
      data: {
        senderId: userId,
        recipientId: recipient.id,
        subject: dto.subject,
        body: dto.body,
        shareToken: dto.enclose ? await this.invitationToken(userId) : null,
      },
      select: LETTER_FIELDS,
    });
  }

  /**
   * The token to enclose with a letter. Reuses the writer's newest live link rather than
   * minting one per letter, so revoking a link closes every door at once instead of leaving
   * a trail of forgotten ones open.
   */
  private async invitationToken(userId: string) {
    const existing = await this.prisma.shareLink.findFirst({
      where: { userId, revoked: false },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    });
    if (existing) return existing.token;

    const created = await this.prisma.shareLink.create({
      data: { userId, token: randomBytes(32).toString('hex') },
      select: { token: true },
    });
    return created.token;
  }

  /** Whether a username belongs to somebody a letter can actually reach. */
  async findRecipient(username: string) {
    const user = await this.prisma.user.findFirst({
      where: { usernameLower: username.toLowerCase(), emailVerified: true },
      select: { username: true },
    });
    return { found: Boolean(user), username: user?.username ?? null };
  }

  async markRead(userId: string, id: string) {
    const letter = await this.prisma.letter.findFirst({
      where: { id, recipientId: userId },
      select: { id: true, readAt: true },
    });
    if (!letter) throw new NotFoundException('Letter not found');

    if (letter.readAt) return letter;

    return this.prisma.letter.update({
      where: { id },
      data: { readAt: new Date() },
      select: LETTER_FIELDS,
    });
  }

  // Either side may delete a letter, but only from their own mailbox's perspective: deleting
  // removes the row entirely, so it disappears for both. Kept simple on purpose.
  async remove(userId: string, id: string) {
    const letter = await this.prisma.letter.findFirst({
      where: { id, OR: [{ recipientId: userId }, { senderId: userId }] },
      select: { id: true },
    });
    if (!letter) throw new NotFoundException('Letter not found');

    await this.prisma.letter.delete({ where: { id } });
    return { deleted: true };
  }
}
