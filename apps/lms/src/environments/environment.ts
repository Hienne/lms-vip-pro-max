import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';
import { mockApiInterceptor } from '../app/core/dev/mock-api/mock-api.interceptor';

/**
 * Development (default: `nx serve lms`, unit tests).
 * `apiBaseUrl: ''` sends `/api/` through the dev-server proxy to the backend on
 * `http://localhost:8019` (`apps/lms/proxy.conf.mjs`). The in-app mock API (`mockApi`) answers
 * every endpoint that has a fixture; endpoints without one go to that backend. Set `mockApi` to
 * false to use the backend for everything.
 */
export const environment: AppConfigInput = {
  name: 'development',
  production: false,
  apiBaseUrl: '',
  mockApi: true,
  devTools: true,
};

/** The only place the mock API is imported, so only a development build can contain it. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [
  mockApiInterceptor,
];
