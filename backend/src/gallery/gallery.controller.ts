import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  list(@CurrentUser() user: RequestUser, @Query('timelineEventId') timelineEventId?: string) {
    return this.gallery.list(user.id, timelineEventId);
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

  /*
    Photographs are the heaviest thing this API sends, and without a word about caching a
    browser has to assume the bytes might have changed and fetch them again every time — so
    closing the album and opening it again downloaded the whole spread from scratch.

    They never change. A photograph's bytes are written once at upload; editing a caption
    touches a different row entirely, and replacing an image creates a new id. `immutable` says
    exactly that, and lets the browser reuse what it already has without even asking.

    `private` keeps it in that one browser and out of any shared cache or CDN in between —
    these bytes are somebody's private photographs, and a copy held anywhere else would be a
    copy nobody could revoke.

    The route stays behind the auth guard: the cache decides whether the browser needs to ask
    again, never whether the answer would be allowed.
  */
  // Must be a StreamableFile: returning a raw ReadStream makes Nest serialise the stream
  // object itself to JSON instead of piping the bytes.
  @Get(':id/file')
  @Header('Cache-Control', 'private, max-age=31536000, immutable')
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
