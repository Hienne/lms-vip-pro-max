import type { HttpInterceptorFn } from '@angular/common/http';
import { randomId } from '../browser/secure-context';

/**
 * Sends `X-Request-Id` with every `/api/` request. The backend echoes it back as the envelope's
 * `responseId`, which an error toast can quote so support can find the call.
 */
export const requestIdInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api/')
    ? next(req.clone({ setHeaders: { 'X-Request-Id': randomId() } }))
    : next(req);
