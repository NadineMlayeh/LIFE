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
import { CreateTimelineEventDto, UpdateTimelineEventDto } from './dto/timeline.dto.js';
import { TimelineService } from './timeline.service.js';

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('search') search?: string) {
    return this.timeline.list(user.id, search);
  }

  @Get(':id')
  findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.timeline.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTimelineEventDto) {
    return this.timeline.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimelineEventDto,
  ) {
    return this.timeline.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.timeline.remove(user.id, id);
  }
}
