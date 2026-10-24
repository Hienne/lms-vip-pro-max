import { DOCUMENT, inject, InjectionToken } from '@angular/core';
import type { PreferenceStorage } from './local-storage';

/**
 * Browser `sessionStorage`, kept per tab, or `null` when the browser blocks it (the getter itself
 * can throw). The twin of `LOCAL_STORAGE` for what must not outlive the tab.
 */
export const SESSION_STORAGE = new InjectionToken<PreferenceStorage | null>(
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
