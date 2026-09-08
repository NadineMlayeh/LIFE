import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BooksService } from './books.service.js';
import { CreateBookDto, UpdateBookDto } from './dto/book.dto.js';

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('includeHidden') includeHidden?: string) {
    return this.books.list(user.id, includeHidden === 'true');
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.books.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateBookDto) {
    return this.books.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateBookDto) {
    return this.books.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.books.remove(user.id, id);
  }
}
