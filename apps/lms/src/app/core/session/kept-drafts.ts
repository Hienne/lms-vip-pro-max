import { DestroyRef, inject, Injectable } from '@angular/core';
import { SESSION_STORAGE } from '../storage/session-storage';

const PREFIX = 'lms.keptDraft:';

/** A draft kept when the session ended, and when. */
export interface KeptDraft<T> {
  readonly value: T;
  readonly keptAt: string;
}

/**
 * Unsaved work that must survive the session ending under it (a 401 sends the user to sign in
 * again). A page with a form registers a keeper while it is open; `SessionExpiry` runs every
 * keeper before it leaves the page, and the page offers the draft back when it opens again in
 * this tab. Kept in `sessionStorage`: it never outlives the tab, and storage that is missing or
 * throws keeps nothing.
 */
@Injectable({ providedIn: 'root' })
export class KeptDrafts {
  private readonly storage = inject(SESSION_STORAGE);
  private readonly keepers = new Set<() => void>();

  /** Runs `keeper` when the session ends, for as long as the caller is alive. */
  whileOpen(keeper: () => void, destroyRef = inject(DestroyRef)): void {
    this.keepers.add(keeper);
    destroyRef.onDestroy(() => this.keepers.delete(keeper));
  }

  /** Asks every open page to keep its unsaved work. */
  keepAll(): void {
    for (const keeper of this.keepers) keeper();
  }

  keep<T>(key: string, value: T): void {
    const kept: KeptDraft<T> = { value, keptAt: new Date().toISOString() };
    try {
      this.storage?.setItem(PREFIX + key, JSON.stringify(kept));
    } catch {
      // Full or blocked storage: the draft is lost as it was before.
    }
  }

  /** The draft kept under `key`, removed as it is read; `null` when there is none or it is unreadable. */
  take<T>(key: string): KeptDraft<T> | null {
    try {
      const raw = this.storage?.getItem(PREFIX + key);
      this.storage?.removeItem(PREFIX + key);
      const kept = raw ? (JSON.parse(raw) as Partial<KeptDraft<T>>) : null;
      return kept && 'value' in kept && typeof kept.keptAt === 'string'
        ? (kept as KeptDraft<T>)
        : null;
    } catch {
      return null;
    }
  }
}
