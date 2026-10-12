import { InjectionToken } from '@angular/core';

/** The clock behind date phrasing ("Còn 3 ngày"): milliseconds since the epoch. Specs replace it. */
export const NOW = new InjectionToken<() => number>('NOW', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});
