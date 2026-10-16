import {
  HttpErrorResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { NetworkStore } from '../network/network.store';

/**
 * Dev only: while the toolbar simulates a lost connection every request fails the way a dead
 * network does (status 0), which the app reports as "offline". It sits in front of the mock API.
 */
export const offlineSimulationInterceptor: HttpInterceptorFn = (req, next) => {
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
  return next(req);
};
