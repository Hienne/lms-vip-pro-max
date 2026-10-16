import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { authEndpoints, UNAUTHENTICATED_CODE } from '@lms/contracts';
import { catchError, throwError } from 'rxjs';
import { ApiError } from './api-error';
import { ENDPOINT } from './endpoint-client';

/** A 401 here is not an expired session: the visitor is anonymous, or the credentials were wrong. */
const EXEMPT = new Set<unknown>([
  authEndpoints.profile,
  authEndpoints.login,
  authEndpoints.loginDemo,
]);

/** The backend refuses the session two ways: an HTTP 401, or a 200 with the `CORE-0401` envelope. */
function isUnauthenticated(error: unknown): boolean {
  return (
    (error instanceof HttpErrorResponse && error.status === 401) ||
    (error instanceof ApiError && error.messageCode === UNAUTHENTICATED_CODE)
  );
}

/**
 * Any other 401, or `CORE-0401`, while signed in means the session ended: it is handed to `SessionExpiry` and the
 * error still reaches the caller. Exempt by endpoint identity, never by URL. `SessionExpiry` is
 * loaded and resolved only on that error path: it depends on `HttpClient` through the session store, and the UI toaster stays out of the initial bundle.
 */
export const sessionExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (isUnauthenticated(error) && !EXEMPT.has(req.context.get(ENDPOINT))) {
        void import('../session/session-expiry').then(({ SessionExpiry }) =>
          injector.get(SessionExpiry).end(),
        );
      }
      return throwError(() => error);
    }),
  );
};
