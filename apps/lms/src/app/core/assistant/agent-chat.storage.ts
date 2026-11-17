import { inject, Injectable } from '@angular/core';
import { PersistedChatSchema, type PersistedChat } from './agent-chat.model';
import { SESSION_STORAGE } from '../storage/session-storage';

const PREFIX = 'lms.agent-chat.v2.';
/** The first shape kept every turn in the tab; the server keeps them now, so it is only removed. */
const LEGACY_PREFIX = 'lms.agent-chat.v1.';
const keyOf = (userId: string): string => `${PREFIX}${userId}`;

const EMPTY: PersistedChat = { open: false };

/**
 * The panel's open state and open conversation id in `sessionStorage`, one entry per user,
 * versioned in its key. Storage can be missing or throw, and an entry can be malformed: a bad entry
 * is removed and counts as an empty chat, and a blocked storage keeps it in memory for this page.
 * An entry of the first shape (with turns in it) is never read, only removed.
 */
@Injectable({ providedIn: 'root' })
export class AgentChatStorage {
  private readonly storage = inject(SESSION_STORAGE);
  /** Stands in for storage the browser blocks. */
  private readonly memory = new Map<string, string>();

  /** What the user left; the old turn-carrying entry is removed on the way. */
  read(userId: string): PersistedChat {
    this.remove(`${LEGACY_PREFIX}${userId}`);
    const raw = this.get(keyOf(userId));
    if (raw === null) return EMPTY;
    let parsed: PersistedChat | undefined;
    try {
      const result = PersistedChatSchema.safeParse(JSON.parse(raw));
      parsed = result.success ? result.data : undefined;
    } catch {
      parsed = undefined;
    }
    if (!parsed) {
      this.remove(keyOf(userId));
      return EMPTY;
    }

    return {
      open: parsed.open,
      ...(parsed.docked ? { docked: true } : {}),
      ...(parsed.conversationId
        ? { conversationId: parsed.conversationId }
        : {}),
    };
  }

  write(userId: string, chat: PersistedChat): void {
    const kept = {
      open: chat.open,
      ...(chat.docked ? { docked: true } : {}),
      ...(chat.conversationId ? { conversationId: chat.conversationId } : {}),
    };
    this.set(keyOf(userId), JSON.stringify(kept));
  }

  clear(userId: string): void {
    this.remove(keyOf(userId));
  }

  /**
   * Removes every conversation in this tab but `userId`'s: one left by a user whose session ended
   * without a sign-out (an expired token, then a reload) must not stay readable by the next one.
   */
  clearOthers(userId: string): void {
    const keep = keyOf(userId);
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
      if (
        (key.startsWith(PREFIX) && key !== keep) ||
        key.startsWith(LEGACY_PREFIX)
      ) {
        this.remove(key);
      }
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
      // Blocked or full storage: keep the chat in memory.
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
