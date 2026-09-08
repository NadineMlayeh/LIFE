import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

// The single seam between LIFE and where bytes physically live. At Phase 6 only this
// implementation changes (local disk -> Supabase Storage); nothing else should need to.
@Injectable()
export class StorageService {
  private readonly root = resolve(process.env.UPLOAD_DIR ?? 'uploads');

  async saveFile(userId: string, folder: string, file: Express.Multer.File): Promise<string> {
    const directory = join(this.root, userId, folder);
    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;
    await writeFile(join(directory, filename), file.buffer);

    return `${userId}/${folder}/${filename}`;
  }

  getFileStream(storagePath: string) {
    const absolute = this.toAbsolute(storagePath);
    if (!existsSync(absolute)) return null;
    return createReadStream(absolute);
  }

  async deleteFile(storagePath: string): Promise<void> {
    const absolute = this.toAbsolute(storagePath);
    if (existsSync(absolute)) {
      await unlink(absolute);
    }
  }

  // storagePath comes from our own database, but resolving it defensively means a corrupted
  // or crafted value can never escape the uploads root.
  private toAbsolute(storagePath: string): string {
    const absolute = resolve(this.root, storagePath);
    if (!absolute.startsWith(this.root)) {
      throw new Error('Invalid storage path');
    }
    return absolute;
  }
}
