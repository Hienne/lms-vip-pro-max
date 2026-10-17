import { inject, Service } from '@angular/core';
import { LOCAL_STORAGE } from '../storage/local-storage';

const KEY = 'lms.accessToken';

/**
 * The access token and the moment it stops being valid, kept in `localStorage` so a reload or
 * another tab stays signed in. Storage can be missing or throw, and an entry can be malformed:
 * each of those counts as no token. The backend has no refresh, so an expired token is dropped.
 */
@Service()
export class TokenStore {
  private readonly storage = inject(LOCAL_STORAGE);

  /** The stored token, or `null` when there is none, it is unreadable or it has expired (and is removed). */
  read(): string | null {
    let stored: unknown;
    try {
      const raw = this.storage?.getItem(KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
    if (!isStoredToken(stored)) return null;
    if (stored.expiresAt <= Date.now()) {
      this.clear();
      return null;
    }
    return stored.accessToken;
  }

  save(accessToken: string, expiresInSeconds: number): void {
    try {
      this.storage?.setItem(
        KEY,
        JSON.stringify({
          accessToken,
          expiresAt: Date.now() + expiresInSeconds * 1000,
        }),
      );
    } catch {
      // Blocked or full storage: the user stays signed in until the page is closed.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // Nothing to remove from storage that cannot be reached.
    }
  }
}

function isStoredToken(
  value: unknown,
): value is { accessToken: string; expiresAt: number } {
  const token = value as { accessToken?: unknown; expiresAt?: unknown } | null;
  return (
    typeof token?.accessToken === 'string' &&
    typeof token.expiresAt === 'number'
  );
}
