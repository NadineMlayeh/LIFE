import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto.js';
import { NotesService } from './notes.service.js';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.notes.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateNoteDto) {
    return this.notes.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notes.remove(user.id, id);
  }
}
