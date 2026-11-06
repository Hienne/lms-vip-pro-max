import type { HttpInterceptorFn } from '@angular/common/http';
import type { AppConfigInput } from '../app/core/config/app-config';
import { mockApiInterceptor } from '../app/core/dev/mock-api/mock-api.interceptor';

/**
 * Development (default: `nx serve lms`, unit tests).
 * The app calls `/api/` on its own origin; the dev-server proxy (`apps/lms/proxy.conf.mjs`)
 * forwards it to the backend (the shared one, or a local one through `LMS_API_TARGET`). The
 * in-app mock API (`mockApi`) answers only the endpoints the backend lacks (role management, a
 * user's courses, attempts and activity, the shell badges); everything else is the real backend.
 */
export const environment: AppConfigInput = {
  name: 'development',
  production: false,
  mockApi: true,
  devTools: true,
};

/** The only place the mock API is imported, so only a development build can contain it. */
export const mockInterceptors: readonly HttpInterceptorFn[] = [
  mockApiInterceptor,
];
