import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';

/**
 * Staging (`nx build lms -c staging`).
 * The app calls `/api/` on its own origin: the reverse proxy that serves it forwards `/api/` to
 * the backend, so the browser needs no CORS and never sees mixed content.
 */
export const environment: AppConfigInput = {
  name: 'staging',
  production: true,
  mockApi: false,
  devTools: true,
};

/** No mock API here: its fixtures must never reach this bundle. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [];
