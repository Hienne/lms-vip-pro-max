import { InjectionToken } from '@angular/core';

/**
 * The clock the relative formats read, in epoch milliseconds. Defaults to `Date.now`; specs provide a
 * fixed one so output is deterministic.
 */
export const NOW = new InjectionToken<() => number>('NOW', {
  providedIn: 'root',
  factory: () => Date.now,
});
