import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { authV1Endpoints } from '@lms/contracts';
import { TokenStore } from '../session/token-store';
import { ENDPOINT } from './endpoint-client';

/**
 * Adds `Authorization: Bearer <token>` to `/api/` requests while a token is stored; the login
 * request and every other URL pass untouched. It must run before `apiBaseUrlInterceptor`, which
 * turns the path into an absolute URL, so the `/api/` test cannot match another origin.
 */
export const bearerInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !req.url.startsWith('/api/') ||
    req.context.get(ENDPOINT) === authV1Endpoints.login
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
