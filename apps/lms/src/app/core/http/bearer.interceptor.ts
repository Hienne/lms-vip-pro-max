import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { authV1Endpoints, identityEndpoints } from '@lms/contracts';
import { TokenStore } from '../session/token-store';
import { ENDPOINT } from './endpoint-client';

/**
 * Adds `Authorization: Bearer <token>` to `/api/` requests while a token is stored; the login
 * and registration requests (public, sent by visitors) and every other URL (including an
 * absolute URL to another origin) pass untouched.
 */
const PUBLIC_ENDPOINTS = new Set<unknown>([
  authV1Endpoints.login,
  identityEndpoints.registrationUnits,
  identityEndpoints.registerRequest,
  identityEndpoints.passwordResetRequest,
]);

export const bearerInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !req.url.startsWith('/api/') ||
    PUBLIC_ENDPOINTS.has(req.context.get(ENDPOINT))
  ) {
    return next(req);
  }
  // Learner media uses the session-bound HttpOnly cookie, like the native PDF/video URLs.
  if (
    req.method === 'GET' &&
    /^\/api\/v1\/learning-assets\/\d+\/content$/.test(req.url) &&
    req.params.has('blockId') &&
    req.params.has('enrollmentId')
  ) {
    return next(req);
  }
  const token = inject(TokenStore).read();
  return next(
    token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req,
  );
};
