import { DOCUMENT, inject, InjectionToken } from '@angular/core';

/** The part of `Storage` the app uses for per-browser preferences and the access token. */
export type PreferenceStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

/** Browser `localStorage`, or `null` when the browser blocks it (the getter itself can throw). */
export const LOCAL_STORAGE = new InjectionToken<PreferenceStorage | null>(
  'LOCAL_STORAGE',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return inject(DOCUMENT).defaultView?.localStorage ?? null;
      } catch {
        return null;
      }
    },
  },
);
