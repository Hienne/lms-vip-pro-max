import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { ErrorHandler, inject } from '@angular/core';
import { EnvelopeSchema } from '@lms/contracts';
import { map } from 'rxjs';
import { ApiError } from './api-error';
import { ContractError } from './contract-error';
import { ENDPOINT } from './endpoint-client';

/**
 * The backend answers every call with HTTP 200 and an envelope, whatever the outcome. For an
 * endpoint call this unwraps it, so everything after it keeps seeing the payload alone:
 * `SUCCESS` continues with `data`, anything else becomes an `ApiError` with the backend's code,
 * title and message, and a body that is not an envelope is a `ContractError`. A request without
 * an endpoint is not an API call and passes untouched, and so does a `blob` endpoint, whose
 * body is a file. It decides nothing about how a failure is shown.
 */
export const envelopeInterceptor: HttpInterceptorFn = (req, next) => {
  const endpoint = req.context.get(ENDPOINT);
  if (!endpoint || endpoint.responseType === 'blob') return next(req);
  const errorHandler = inject(ErrorHandler);
  return next(req).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;
      const envelope = EnvelopeSchema.safeParse(event.body);
      if (!envelope.success) {
        const error = new ContractError(envelope.error.issues);
        errorHandler.handleError(error);
        throw error;
      }
      const { status, messageCode, messageTitle, message, data } =
        envelope.data;
      if (status === 'ERROR') {
        throw new ApiError(
          messageCode,
          messageTitle ?? undefined,
          message ?? undefined,
        );
      }
      return event.clone({ body: data });
    }),
  );
};
