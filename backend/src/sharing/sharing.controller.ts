import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { StorageService } from '../storage/storage.service.js';
import { SharingService } from './sharing.service.js';

@Controller('share-links')
@UseGuards(JwtAuthGuard)
export class ShareLinksController {
  constructor(private readonly sharing: SharingService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.sharing.listLinks(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser) {
    return this.sharing.createLink(user.id);
  }

  @Delete(':id')
  revoke(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.sharing.revokeLink(user.id, id);
  }
}

// Deliberately unguarded: the token in the URL is the credential. Every method re-validates
// it rather than assuming an earlier call did.
@Controller('shared')
export class SharedViewController {
  constructor(
    private readonly sharing: SharingService,
    private readonly storage: StorageService,
  ) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.sharing.getSharedView(token);
  }

  @Get(':token/photos/:photoId/file')
  async photo(@Param('token') token: string, @Param('photoId') photoId: string) {
    const photo = await this.sharing.getSharedPhoto(token, photoId);
    const stream = this.storage.getFileStream(photo.storagePath);
    if (!stream) throw new NotFoundException('Image file is missing from storage');

    return new StreamableFile(stream, { type: photo.mimeType });
  }
}
