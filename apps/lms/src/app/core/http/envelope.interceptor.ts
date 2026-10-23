import {
  HttpErrorResponse,
  HttpResponse,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { ErrorHandler, inject } from '@angular/core';
import {
  type AnyEndpoint,
  type Envelope,
  EnvelopeSchema,
} from '@lms/contracts';
import { catchError, map, throwError } from 'rxjs';
import { ApiError } from './api-error';
import { ContractError } from './contract-error';
import { ENDPOINT } from './endpoint-client';

const NDJSON = 'application/x-ndjson';

/** A streamed endpoint is read as text, so a refusal's JSON envelope arrives as a string. */
function envelopeBody(endpoint: AnyEndpoint, body: unknown): unknown {
  if (endpoint.responseType !== 'ndjson' || typeof body !== 'string') {
    return body;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function toApiError(envelope: Envelope, httpStatus: number): ApiError {
  const { messageCode, messageTitle, message, responseId } = envelope;
  return new ApiError(
    messageCode,
    messageTitle ?? undefined,
    message ?? undefined,
    httpStatus,
    responseId ?? undefined,
  );
}

/**
 * Every API answer is wrapped in an envelope. For an endpoint call this unwraps it, so everything
 * after it keeps seeing the payload alone: `SUCCESS` continues with `data`, anything else becomes
 * an `ApiError` with the backend's code, title and message, and a 2xx body that is not an
 * envelope is a `ContractError`. The backend also puts an envelope in the body of a 4xx/5xx
 * answer; that body is read too, so a wrong password or a missing permission keeps the backend's
 * own message. A failure without an envelope (offline, a proxy's error page) passes through as
 * the `HttpErrorResponse`. A request without an endpoint is not an API call and passes untouched,
 * and so does a `blob` endpoint, whose body is a file, and the events and `application/x-ndjson`
 * answer of a streamed endpoint (only its refusals are envelopes). It decides nothing about how a failure is
 * shown.
 */
export const envelopeInterceptor: HttpInterceptorFn = (req, next) => {
  const endpoint = req.context.get(ENDPOINT);
  if (!endpoint || endpoint.responseType === 'blob') return next(req);
  const errorHandler = inject(ErrorHandler);
  return next(req).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;
      if (event.headers.get('Content-Type')?.includes(NDJSON)) return event;
      const envelope = EnvelopeSchema.safeParse(
        envelopeBody(endpoint, event.body),
      );
      if (!envelope.success) {
        const error = new ContractError(envelope.error.issues);
        errorHandler.handleError(error);
        throw error;
      }
      if (envelope.data.status === 'ERROR') {
        throw toApiError(envelope.data, event.status);
      }
      return event.clone({ body: envelope.data.data });
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const envelope = EnvelopeSchema.safeParse(
          envelopeBody(endpoint, error.error),
        );
        if (envelope.success) {
          return throwError(() => toApiError(envelope.data, error.status));
        }
      }
      return throwError(() => error);
    }),
  );
};
