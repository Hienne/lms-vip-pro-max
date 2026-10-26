import { DOCUMENT, inject, InjectionToken } from '@angular/core';
import type { PreferenceStorage } from './local-storage';

/** What is read from `sessionStorage`: the preference calls, plus listing keys to clean up. */
export type TabStorage = PreferenceStorage & Pick<Storage, 'key' | 'length'>;

/**
 * Browser `sessionStorage`, kept per tab, or `null` when the browser blocks it (the getter itself
 * can throw). The twin of `LOCAL_STORAGE` for what must not outlive the tab.
 */
export const SESSION_STORAGE = new InjectionToken<TabStorage | null>(
  'SESSION_STORAGE',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return inject(DOCUMENT).defaultView?.sessionStorage ?? null;
      } catch {
        return null;
      }
    },
  },
);
