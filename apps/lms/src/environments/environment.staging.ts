import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';

/**
 * Staging (`nx build lms -c staging`).
 * `apiBaseUrl: ''`: the API is served from the same origin as the app (an HTTPS reverse proxy
 * forwards `/api/` to the backend, so the browser never sees mixed content).
 */
export const environment: AppConfigInput = {
  name: 'staging',
  production: true,
  apiBaseUrl: '',
  mockApi: false,
  mockBackend: false,
  devTools: true,
};

/** No mock API here: its fixtures must never reach this bundle. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [];
