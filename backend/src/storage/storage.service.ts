import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Readable as NodeReadable } from 'node:stream';
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
import { PrismaService } from '../prisma/prisma.service.js';
import type { Readable } from 'node:stream';

/**
 * The single seam between LIFE and where the bytes of a photograph physically live.
 *
 * Three backends, chosen by configuration:
 *
 *  1. **Object storage** — used whenever `S3_BUCKET` is set. Anything S3-compatible: Cloudflare
 *     R2, Backblaze B2, S3 itself. The right home for files, and the one to grow into.
 *  2. **The database** — used when `STORE_FILES_IN_DB` is on. Not where files belong, but it
 *     needs no second account and no payment card, which every object-storage free tier now
 *     asks for. For a personal archive it is entirely workable: browser-compressed photographs
 *     are around 300 KB, so a 0.5 GB free Postgres holds roughly fifteen hundred of them.
 *  3. **Local disk** — the default, for development.
 *
 * **One of the first two is required in production.** Serverless hosting has no persistent
 * filesystem: a file written during one request is gone before the next, because the machine
 * that handled it no longer exists. Falling back to disk there loses every upload *silently*,
 * which is the worst kind of failure — it looks like it worked.
 *
 * Nothing outside this file knows which is in use. The rest of the application deals in
 * `storagePath` strings and never touches a filesystem. Moving between the three is a change
 * of environment variables, not of code.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = resolve(process.env.UPLOAD_DIR ?? 'uploads');
  private readonly bucket = process.env.S3_BUCKET;
  private readonly inDatabase = process.env.STORE_FILES_IN_DB === 'true';
  private readonly client: S3Client | null;

  /**
   * True on a host with no writable filesystem. Vercel sets `VERCEL`; most platforms set
   * `NODE_ENV=production`. Either way, writing a file to disk there is not merely a bad idea —
   * it fails, and it fails at upload time rather than at deploy time.
   */
  private readonly ephemeral =
    process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  constructor(private readonly prisma: PrismaService) {
    if (!this.bucket) {
      this.client = null;

      if (this.inDatabase) {
        this.logger.log('Photographs are stored in the database');
      } else if (this.ephemeral) {
        // Loud, once, at startup — so the cause is in the deployment log rather than only
        // showing up later as an unexplained 500 on the first upload.
        this.logger.error(
          'No photograph storage is configured. Set STORE_FILES_IN_DB=true, or the S3_* ' +
            'variables for a bucket. This host has no writable filesystem, so uploads will ' +
            'fail until one of those is set.',
        );
      } else {
        this.logger.log('Photographs are stored on local disk');
      }
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

    if (this.inDatabase) {
      await this.prisma.storedFile.create({
        data: {
          path: key,
          // Multer gives a Node Buffer; Prisma's Bytes column wants a plain Uint8Array, and
          // TypeScript will not treat one as the other because a Buffer may be backed by
          // shared memory. Copying into a Uint8Array is the honest conversion.
          data: new Uint8Array(file.buffer),
          mimeType: file.mimetype,
          size: file.size,
        },
      });
      return key;
    }

    if (this.ephemeral) {
      // Better a clear message than an EROFS stack trace the caller sees as a bare 500.
      throw new ServiceUnavailableException(
        'Photograph storage is not configured on this server.',
      );
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

    if (this.inDatabase) {
      const row = await this.prisma.storedFile.findUnique({ where: { path: storagePath } });
      if (!row) return null;
      /*
        Wrapped in an ARRAY, which is not a detail to skip.

        `Readable.from` treats its argument as an iterable, and a Uint8Array iterates over
        individual *numbers* — so passing the bytes directly emits one integer per byte and the
        HTTP response rejects the first one. Putting it in an array makes the stream yield the
        whole buffer as a single chunk, which is what a file read looks like.
      */
      return NodeReadable.from([Buffer.from(row.data)]);
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

    if (this.inDatabase) {
      // `deleteMany` rather than `delete`: removing a file that is already gone should be a
      // no-op, not an error.
      await this.prisma.storedFile.deleteMany({ where: { path: storagePath } });
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
