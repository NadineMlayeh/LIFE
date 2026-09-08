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
import { UpdateFileDto } from './dto/file.dto.js';
import { FilesService } from './files.service.js';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query('timelineEventId') timelineEventId?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.files.list(user.id, timelineEventId, itemId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('timelineEventId') timelineEventId?: string,
    @Body('itemId') itemId?: string,
  ) {
    return this.files.upload(user.id, file, { timelineEventId, itemId });
  }

  @Get(':id/download')
  async download(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const { stream, file } = await this.files.download(user.id, id);
    return new StreamableFile(stream, {
      type: file.mimeType,
      disposition: `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    });
  }

  @Patch(':id')
  update(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.files.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.files.remove(user.id, id);
  }
}
