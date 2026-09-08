import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { BooksModule } from './books/books.module.js';
import { ChaptersModule } from './chapters/chapters.module.js';
import { FilesModule } from './files/files.module.js';
import { GalleryModule } from './gallery/gallery.module.js';
import { ItemsModule } from './items/items.module.js';
import { MailModule } from './mail/mail.module.js';
import { MailboxModule } from './mailbox/mailbox.module.js';
import { MapModule } from './map/map.module.js';
import { NotesModule } from './notes/notes.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SharingModule } from './sharing/sharing.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TimelineModule } from './timeline/timeline.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    StorageModule,
    PrivacyModule,
    AuthModule,
    ProfilesModule,
    BooksModule,
    ChaptersModule,
    ItemsModule,
    TimelineModule,
    NotesModule,
    GalleryModule,
    FilesModule,
    MapModule,
    MailboxModule,
    SharingModule,
  ],
})
export class AppModule {}
