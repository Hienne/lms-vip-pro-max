import { InjectionToken } from '@angular/core';

/** Opens help for the current route when the app header is hidden. */
export const OPEN_PAGE_GUIDE = new InjectionToken<() => void>(
  'OPEN_PAGE_GUIDE',
);
