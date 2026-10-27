import { inject, Injectable } from '@angular/core';
import { BlockTypeSchema } from '@lms/contracts';
import { z } from 'zod';
import { LOCAL_STORAGE } from '../../../../core/storage/local-storage';

/**
 * An upload that outlives a reload: what the author picks the file again against. No bytes are
 * kept. `position` is where the block sat in the lesson tree (`chapter.lesson.block`), because
 * the editor's own block keys do not survive a reload.
 */
const KeptUploadSchema = z.object({
  uploadId: z.uuid(),
  position: z.string().regex(/^\d+\.\d+\.\d+$/),
  blockType: BlockTypeSchema,
  name: z.string(),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** When the server forgets the upload; null when it did not say. */
  expiresAt: z.string().nullable(),
});
export type KeptUpload = z.infer<typeof KeptUploadSchema>;

const PREFIX = 'lms.asset-uploads.v1.';
const keyOf = (userId: string, courseId: number): string =>
  `${PREFIX}${userId}.${courseId}`;

/** Server dates are local wall-clock strings without an offset (the editor's `BackendDateTime`). */
const expired = (upload: KeptUpload): boolean =>
  upload.expiresAt !== null &&
  new Date(upload.expiresAt).getTime() <= Date.now();

/**
 * The uploads a course editor can still resume, per user and course, in `localStorage`. Storage
 * can be missing or throw and an entry can be malformed: a bad entry is removed and counts as
 * none, and blocked storage keeps the uploads in memory for the page's life.
 */
@Injectable({ providedIn: 'root' })
export class KeptUploads {
  private readonly storage = inject(LOCAL_STORAGE);
  /** Stands in for storage the browser blocks. */
  private readonly memory = new Map<string, string>();

  /** The kept uploads the server still holds; the others are forgotten. */
  read(userId: string, courseId: number): KeptUpload[] {
    const key = keyOf(userId, courseId);
    const raw = this.get(key);
    if (raw === null) return [];
    try {
      const result = z.array(KeptUploadSchema).safeParse(JSON.parse(raw));
      if (result.success) {
        const alive = result.data.filter((upload) => !expired(upload));
        if (alive.length !== result.data.length)
          this.write(userId, courseId, alive);
        return alive;
      }
    } catch {
      // Not JSON: treated like any other bad entry.
    }
    this.remove(key);
    return [];
  }

  write(
    userId: string,
    courseId: number,
    uploads: readonly KeptUpload[],
  ): void {
    const key = keyOf(userId, courseId);
    if (uploads.length === 0) {
      this.remove(key);
      return;
    }
    this.set(key, JSON.stringify(uploads));
  }

  private get(key: string): string | null {
    try {
      if (this.storage) return this.storage.getItem(key);
    } catch {
      // Blocked storage: fall through to memory.
    }
    return this.memory.get(key) ?? null;
  }

  private set(key: string, value: string): void {
    try {
      if (this.storage) {
        this.storage.setItem(key, value);
        return;
      }
    } catch {
      // Blocked or full storage: keep them in memory.
    }
    this.memory.set(key, value);
  }

  private remove(key: string): void {
    this.memory.delete(key);
    try {
      this.storage?.removeItem(key);
    } catch {
      // Nothing to remove from storage that cannot be reached.
    }
  }
}
