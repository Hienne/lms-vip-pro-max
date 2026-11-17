import { inject, Injectable } from '@angular/core';
import { SESSION_STORAGE } from '../../../../core/storage/session-storage';

const PREFIX = 'lms.assistant-page.v1.';
const keyOf = (userId: string): string => `${PREFIX}${userId}`;

/**
 * The id of the conversation open on the `/assistant` page, in this tab's `sessionStorage`, one
 * entry per user. Nothing else is kept: the turns are the server's and are read again on a reload.
 * Blocked or malformed storage counts as nothing open.
 */
@Injectable({ providedIn: 'root' })
export class AssistantViewStorage {
  private readonly storage = inject(SESSION_STORAGE);

  read(userId: string): number | null {
    try {
      const raw = this.storage?.getItem(keyOf(userId));
      const id = raw === null || raw === undefined ? NaN : Number(raw);
      return Number.isInteger(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  /** Remembers the open conversation, or forgets it when there is none. */
  write(userId: string, conversationId: number | null): void {
    try {
      if (conversationId === null) this.storage?.removeItem(keyOf(userId));
      else this.storage?.setItem(keyOf(userId), String(conversationId));
    } catch {
      // Blocked or full storage: the page simply starts empty after a reload.
    }
  }
}
