import { inject, Injectable } from '@angular/core';
import { z } from 'zod';
import { SESSION_STORAGE } from '../../../../core/storage/session-storage';

/** The ids a tab echoes when it claims again, so changing block is not a takeover. */
const HeldSessionSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int().positive(),
});
export type HeldSession = z.infer<typeof HeldSessionSchema>;

const PREFIX = 'lms.study-session.v1.';
const keyOf = (userId: string, enrollmentId: number): string =>
  `${PREFIX}${userId}.${enrollmentId}`;

/**
 * The tab's last study session per user and enrolment, in `sessionStorage` (never `localStorage`:
 * a session id must not reach another tab). A reload in the same tab claims again with these ids
 * and is not asked to take over. Storage can be missing or throw, and an entry can be malformed:
 * a bad entry is removed and counts as none, and blocked storage keeps the ids in memory.
 */
@Injectable({ providedIn: 'root' })
export class StudySessionStorage {
  private readonly storage = inject(SESSION_STORAGE);
  /** Stands in for storage the browser blocks. */
  private readonly memory = new Map<string, string>();

  read(userId: string, enrollmentId: number): HeldSession | null {
    const key = keyOf(userId, enrollmentId);
    const raw = this.get(key);
    if (raw === null) return null;
    try {
      const result = HeldSessionSchema.safeParse(JSON.parse(raw));
      if (result.success) return result.data;
    } catch {
      // Not JSON: treated like any other bad entry.
    }
    this.remove(key);
    return null;
  }

  write(userId: string, enrollmentId: number, held: HeldSession): void {
    this.set(
      keyOf(userId, enrollmentId),
      JSON.stringify({
        sessionId: held.sessionId,
        sessionFence: held.sessionFence,
      }),
    );
  }

  clear(userId: string, enrollmentId: number): void {
    this.remove(keyOf(userId, enrollmentId));
  }

  /** Sign-out: no session of this tab stays readable by the next user. */
  clearAll(): void {
    const keys = [...this.memory.keys()];
    try {
      if (this.storage) {
        for (let i = 0; i < this.storage.length; i++) {
          const key = this.storage.key(i);
          if (key !== null) keys.push(key);
        }
      }
    } catch {
      // Storage that cannot be listed holds nothing this page wrote.
    }
    for (const key of keys) {
      if (key.startsWith(PREFIX)) this.remove(key);
    }
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
      // Blocked or full storage: keep the ids in memory.
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
