import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChaptersService } from './chapters.service.js';
import { CreateChapterDto, UpdateChapterDto } from './dto/chapter.dto.js';

@Controller('chapters')
@UseGuards(JwtAuthGuard)
export class ChaptersController {
  constructor(private readonly chapters: ChaptersService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateChapterDto) {
    return this.chapters.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateChapterDto) {
    return this.chapters.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.chapters.remove(user.id, id);
  }
}
