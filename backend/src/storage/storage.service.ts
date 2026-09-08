import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

/**
 * The single seam between LIFE and where the bytes of a photograph physically live.
 *
 * Two backends, chosen by whether `S3_BUCKET` is set:
 *
 *  - **Local disk**, for development. Simple, free, and inspectable — the files are just there
 *    in a folder you can open.
 *  - **Object storage**, for deployment. Anything S3-compatible: Cloudflare R2, Backblaze B2,
 *    S3 itself. This is not optional in production, because serverless hosting has **no
 *    persistent disk** — a file written during one request is gone before the next, since the
 *    machine that handled it no longer exists. Local disk in production silently loses every
 *    upload, which is the worst kind of failure: it looks like it worked.
 *
 * Nothing outside this file knows which is in use. The rest of the application deals in
 * `storagePath` strings and never touches a filesystem.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  private readonly bucket = process.env.S3_BUCKET;
  private readonly client: S3Client | null;

  constructor() {
    if (!this.bucket) {
      this.client = null;
      this.logger.log('Photographs are stored on local disk');
      return;
    }

    this.client = new S3Client({
      // R2 and most S3-compatibles need an explicit endpoint; real S3 does not.
      endpoint: process.env.S3_ENDPOINT,
      // R2 ignores regions but the SDK insists on one being present.
      region: process.env.S3_REGION ?? 'auto',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });
    this.logger.log(`Photographs are stored in bucket "${this.bucket}"`);
  }

  async saveFile(userId: string, folder: string, file: Express.Multer.File): Promise<string> {
    // A random name, never the uploaded one: two people uploading `photo.jpg` must not collide,
    // and an attacker-chosen filename must never reach a path.
    const key = `${userId}/${folder}/${randomUUID()}${extname(file.originalname).toLowerCase()}`;

    if (this.client && this.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return key;
    }

    const directory = join(this.root, userId, folder);
    await mkdir(directory, { recursive: true });
    await writeFile(join(this.root, key), file.buffer);
    return key;
  }

  /**
   * The bytes of a stored file, or `null` if it is missing.
   *
   * Deliberately streamed through the API rather than handed out as a public bucket URL. A
   * public URL is a permanent, unguessable-but-unrevokable key: anyone who ever saw it keeps
   * access forever, regardless of what the owner later decides. Passing the bytes through the
   * API means every read is checked against the current privacy rules.
   */
  async getFileStream(storagePath: string): Promise<Readable | null> {
    if (this.client && this.bucket) {
      try {
        const result = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: storagePath }),
        );
        return (result.Body as Readable) ?? null;
      } catch {
        return null;
      }
    }

    const absolute = this.toAbsolute(storagePath);
    if (!existsSync(absolute)) return null;
    return createReadStream(absolute);
  }

  async deleteFile(storagePath: string): Promise<void> {
    if (this.client && this.bucket) {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: storagePath }),
      );
      return;
    }

    const absolute = this.toAbsolute(storagePath);
    if (existsSync(absolute)) {
      await unlink(absolute);
    }
  }

  /**
   * `storagePath` comes from our own database, but it is resolved defensively anyway: if a row
   * were ever corrupted or crafted to contain `../../etc/passwd`, this is what stops it
   * escaping the uploads folder.
   */
  private toAbsolute(storagePath: string): string {
    const absolute = resolve(this.root, storagePath);
    if (!absolute.startsWith(this.root)) {
      throw new Error('Invalid storage path');
    }
    return absolute;
  }
}
