import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AnyEndpoint } from '@lms/contracts';
import { FakeBackend, type FakeRequest } from '@lms/mocks';
import { of, throwError } from 'rxjs';
import { APP_CONFIG } from '../../config/app-config';
import { ENDPOINT } from '../../http/endpoint-client';

/** The one in-memory backend of the page; a reload starts again from the seed. */
@Injectable({ providedIn: 'root' })
export class MockBackend extends FakeBackend {}

const warned = new Set<unknown>();

function warnOnce(key: unknown, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

function bearerOf(req: HttpRequest<unknown>): string | null {
  const header = req.headers.get('Authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** Reads the `{name}` segments of the endpoint's path out of the request URL. */
function paramsOf(
  endpoint: AnyEndpoint,
  req: HttpRequest<unknown>,
): Record<string, string> {
  const path = req.url.split('?')[0];
  const pattern = new RegExp(
    `${endpoint.path.replace(/\{(\w+)\}/g, '(?<$1>[^/]+)')}$`,
  );
  const groups = pattern.exec(path)?.groups ?? {};
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [
      key,
      decodeURIComponent(value),
    ]),
  );
}

function queryOf(req: HttpRequest<unknown>): Record<string, string> {
  return Object.fromEntries(
    req.params.keys().flatMap((key) => {
      const values = req.params.getAll(key);
      return values === null ? [] : [[key, values.join(',')] as const];
    }),
  );
}

/**
 * Dev only: answers a request from the mock API instead of the network. The endpoint comes from
 * the `ENDPOINT` context `EndpointClient` sets, and is looked up by object. The seeded in-memory
 * backend (`FakeBackend`) answers it with the real HTTP status and envelope when the endpoint is
 * declared `served: 'mock'` (the backend lacks it), or when `mockBackend` is on and the endpoint
 * is one the backend has. A 4xx or 5xx is thrown as an `HttpErrorResponse`, which is how the
 * browser reports it, and `envelopeInterceptor` reads the envelope from it. Anything else goes on
 * to the network, with one warning per endpoint.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const endpoint = req.context.get(ENDPOINT);
  const mocked = endpoint?.served === 'mock' || inject(APP_CONFIG).mockBackend;
  const reply =
    endpoint && mocked
      ? inject(MockBackend).handle(endpoint, {
          token: bearerOf(req),
          params: paramsOf(endpoint, req),
          query: queryOf(req),
          body: req.body,
        })
      : undefined;
  if (reply) {
    // A file endpoint answers its refusals as a JSON body that the browser hands over as a blob.
    const asBlob = endpoint?.responseType === 'blob';
    const jsonBody = () =>
      asBlob
        ? new Blob([JSON.stringify(reply.body)], { type: 'application/json' })
        : reply.body;
    return reply.status < 400
      ? of(
          reply.events
            ? new HttpResponse({
                status: reply.status,
                headers: new HttpHeaders({
                  'Content-Type': 'application/x-ndjson',
                }),
                body: reply.events
                  .map((e) => `${JSON.stringify(e)}\n`)
                  .join(''),
              })
            : new HttpResponse({
                status: reply.status,
                body: reply.file ?? jsonBody(),
              }),
        )
      : throwError(
          () =>
            new HttpErrorResponse({
              status: reply.status,
              error: jsonBody(),
              url: req.url,
            }),
        );
  }
  warnOnce(
    endpoint ?? req.url,
    `Mock API: no mock for ${endpoint ? `${endpoint.method.toUpperCase()} ${endpoint.path}` : req.url}; sending it to the network.`,
  );
  return next(req);
};
