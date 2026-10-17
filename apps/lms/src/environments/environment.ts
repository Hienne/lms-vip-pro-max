import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';
import { mockApiInterceptor } from '../app/core/dev/mock-api/mock-api.interceptor';

/**
 * Development (default: `nx serve lms`, unit tests).
 * The in-app mock API (`mockApi`) answers every endpoint that has a fixture; endpoints without
 * one (the v1 auth calls) go to the backend at `apiBaseUrl`. Set `mockApi` to false to use the
 * backend for everything.
 */
export const environment: AppConfigInput = {
  name: 'development',
  production: false,
  apiBaseUrl: 'http://103.121.90.119:8019',
  mockApi: true,
  devTools: true,
};

/** The only place the mock API is imported, so only a development build can contain it. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [
  mockApiInterceptor,
];
