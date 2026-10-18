import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';
import { mockApiInterceptor } from '../app/core/dev/mock-api/mock-api.interceptor';

/**
 * Development (default: `nx serve lms`, unit tests).
 * `apiBaseUrl: ''` sends `/api/` through the dev-server proxy to the backend on
 * `http://localhost:8019` (`apps/lms/proxy.conf.mjs`). The in-app mock API (`mockApi`) answers
 * the endpoints the backend lacks (role management, a user's courses, attempts and activity, the
 * shell badges). `mockBackend` also answers the endpoints the backend has, from a seeded copy of
 * its demo database, so the app runs without a backend; set it to false to use the real one.
 */
export const environment: AppConfigInput = {
  name: 'development',
  production: false,
  apiBaseUrl: '',
  mockApi: true,
  mockBackend: true,
  devTools: true,
};

/** The only place the mock API is imported, so only a development build can contain it. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [
  mockApiInterceptor,
];
