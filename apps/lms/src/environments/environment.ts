import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';
import { mockApiInterceptor } from '../app/core/dev/mock-api/mock-api.interceptor';

/**
 * Development (default: `nx serve lms`, unit tests).
 * Runs against the in-app mock API (`mockApi`), so `npm start` needs no backend. Set `mockApi`
 * to false to use a backend through the dev-server proxy (apps/lms/proxy.conf.mjs).
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
