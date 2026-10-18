import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * A fresh id for `X-Request-Id`: 1 to 64 characters, starting with a letter or digit, then
 * letters, digits, dots, underscores or hyphens. `crypto.randomUUID` only exists in secure
 * contexts, so a plain-HTTP page falls back to random hex.
 */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

/**
 * Sends `X-Request-Id` with every `/api/` request. The backend echoes it back as the envelope's
 * `responseId`, which an error toast can quote so support can find the call. It runs before
 * `apiBaseUrlInterceptor`, like `bearerInterceptor`, so the `/api/` test sees the relative path.
 */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api/')
    ? next(req.clone({ setHeaders: { 'X-Request-Id': newRequestId() } }))
    : next(req);
