import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { authV1Endpoints, identityEndpoints } from '@lms/contracts';
import { catchError, throwError } from 'rxjs';
import { toAppError } from '../errors/app-error';
import { ENDPOINT } from './endpoint-client';

/**
 * A 401 here is not an expired session: the visitor is anonymous, the credentials were wrong, or
 * the token is already gone (a 401 on logout means signed out all the same).
 */
const EXEMPT = new Set<unknown>([
  authV1Endpoints.me,
  authV1Endpoints.login,
  authV1Endpoints.logout,
  identityEndpoints.registrationUnits,
  identityEndpoints.registerRequest,
  identityEndpoints.passwordResetRequest,
]);

/**
 * Any other failure `toAppError` calls `unauthorized` (an HTTP 401, whatever its code, or
 * `CORE-UNAUTHENTICATED`) while signed in means the session ended: it is handed to `SessionExpiry`
 * and the error still reaches the caller. Exempt by endpoint identity, never by URL. `SessionExpiry` is
 * loaded and resolved only on that error path: it depends on `HttpClient` through the session store, and the UI toaster stays out of the initial bundle.
 */
export const sessionExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        toAppError(error).kind === 'unauthorized' &&
        !EXEMPT.has(req.context.get(ENDPOINT))
      ) {
        void import('../session/session-expiry').then(({ SessionExpiry }) =>
          injector.get(SessionExpiry).end(),
        );
      }
      return throwError(() => error);
    }),
  );
};
