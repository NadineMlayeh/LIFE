import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendLetterDto } from './dto/letter.dto.js';

// Letters carry only the correspondent's email, never their user id or any of their content.
const LETTER_FIELDS = {
  id: true,
  subject: true,
  body: true,
  readAt: true,
  createdAt: true,
  sender: { select: { email: true } },
  recipient: { select: { email: true } },
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
    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.recipientEmail.toLowerCase() },
      select: { id: true, emailVerified: true },
    });

    // Deliberate trade-off: telling the sender the address is unknown reveals whether an
    // email has a LIFE account. For a letter you expect to be delivered, silently dropping it
    // is the worse failure. Revisit if LIFE ever opens up to strangers.
    if (!recipient || !recipient.emailVerified) {
      throw new NotFoundException('No LIFE account with that email address');
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
      },
      select: LETTER_FIELDS,
    });
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
