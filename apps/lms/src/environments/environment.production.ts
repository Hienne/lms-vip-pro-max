import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';

/**
 * Production (`nx build lms`, the default configuration).
 * TODO(backend): set apiBaseUrl to the production API origin, e.g. 'https://<api-host>';
 * '' means the API is served from the same origin as the app.
 */
export const environment: AppConfigInput = {
  name: 'production',
  production: true,
  apiBaseUrl: '',
  mockApi: false,
  devTools: false,
};

/** No mock API here: its fixtures must never reach this bundle. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [];
