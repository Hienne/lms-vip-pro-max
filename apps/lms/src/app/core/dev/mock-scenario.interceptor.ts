import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  adminOrgEndpoints,
  authEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import { throwError } from 'rxjs';
import { NetworkStore } from '../network/network.store';
import { MockScenario } from './mock-scenario';

/**
 * The endpoints that have one Prism example per role. A spec checks this list against
 * `endpointExamples` in `@lms/mocks` (the app itself may not import the mocks), so a new
 * role-dependent endpoint that is missing here fails a test.
 */
export const ROLE_EXAMPLE_ENDPOINTS = {
  profile: authEndpoints.profile,
  navCounts: shellEndpoints.navCounts,
  users: adminOrgEndpoints.users,
  adminMeta: adminOrgEndpoints.adminMeta,
} as const;

const ROLE_PATHS: ReadonlySet<string> = new Set(
  Object.values(ROLE_EXAMPLE_ENDPOINTS).map((endpoint) => endpoint.path),
);

const pathOf = (url: string) => new URL(url, 'http://app.local').pathname;

/**
 * Dev only: drives Prism from the toolbar. Role-dependent reads carry `Prefer: example=<role>`,
 * and while the toolbar simulates a lost connection every request fails the way a dead network
 * does (status 0), which the app reports as "offline".
 */
export const mockScenarioInterceptor: HttpInterceptorFn = (req, next) => {
  if (inject(NetworkStore).offline$()) {
    return throwError(
      () =>
        new HttpErrorResponse({
          url: req.url,
          status: 0,
          statusText: 'Unknown Error',
        }),
    );
  }
  const role = inject(MockScenario).role$();
  if (role && req.method === 'GET' && ROLE_PATHS.has(pathOf(req.url))) {
    return next(req.clone({ setHeaders: { Prefer: `example=${role}` } }));
  }
  return next(req);
};
