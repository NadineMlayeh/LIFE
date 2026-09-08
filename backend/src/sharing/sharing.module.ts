import { Module } from '@nestjs/common';
import { SharedViewController, ShareLinksController } from './sharing.controller.js';
import { SharingService } from './sharing.service.js';

@Module({
  controllers: [ShareLinksController, SharedViewController],
  providers: [SharingService],
})
export class SharingModule {}
