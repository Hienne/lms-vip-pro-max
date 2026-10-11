import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

/** Prefixes `/api/...` requests with the environment's `apiBaseUrl`; other URLs pass through. */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const { apiBaseUrl } = inject(APP_CONFIG);
  if (!apiBaseUrl || !req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ url: `${apiBaseUrl}${req.url}` }));
};
