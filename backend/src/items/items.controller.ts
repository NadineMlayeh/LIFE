import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto.js';
import { ItemsService } from './items.service.js';

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateItemDto) {
    return this.items.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.items.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.items.remove(user.id, id);
  }
}
