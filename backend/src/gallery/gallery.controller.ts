import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UpdatePhotoDto } from './dto/photo.dto.js';
import { GalleryService } from './gallery.service.js';

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('timelineEventId') timelineEventId?: string,
    @Query('bookId') bookId?: string,
  ) {
    return this.gallery.list(user.id, timelineEventId, bookId);
  }

  @Get('featured')
  featured(@CurrentUser() user: RequestUser) {
    return this.gallery.getFeatured(user.id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    return this.gallery.upload(user.id, file, caption);
  }

  // Must be a StreamableFile: returning a raw ReadStream makes Nest serialise the stream
  // object itself to JSON instead of piping the bytes.
  @Get(':id/file')
  async file(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const { stream, mimeType } = await this.gallery.getFile(user.id, id);
    return new StreamableFile(stream, { type: mimeType });
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdatePhotoDto) {
    return this.gallery.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.gallery.remove(user.id, id);
  }
}
