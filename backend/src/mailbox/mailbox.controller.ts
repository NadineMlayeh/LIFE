import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SendLetterDto } from './dto/letter.dto.js';
import { MailboxService } from './mailbox.service.js';

@Controller('mailbox')
@UseGuards(JwtAuthGuard)
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Get('inbox')
  inbox(@CurrentUser() user: RequestUser) {
    return this.mailbox.inbox(user.id);
  }

  @Get('sent')
  sent(@CurrentUser() user: RequestUser) {
    return this.mailbox.sent(user.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: RequestUser) {
    return this.mailbox.unreadCount(user.id);
  }

  @Post()
  send(@CurrentUser() user: RequestUser, @Body() dto: SendLetterDto) {
    return this.mailbox.send(user.id, dto);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.mailbox.markRead(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.mailbox.remove(user.id, id);
  }
}
