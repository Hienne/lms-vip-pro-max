import {
  HttpErrorResponse,
  HttpResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { AnyEndpoint } from '@lms/contracts';
import {
  envelopeOk,
  FakeBackend,
  type FakeRequest,
  MOCK_FIXTURES,
} from '@lms/mocks';
import { of, throwError } from 'rxjs';
import { APP_CONFIG } from '../../config/app-config';
import { ENDPOINT } from '../../http/endpoint-client';

/** The one in-memory backend of the page; a reload starts again from the seed. */
@Injectable({ providedIn: 'root' })
export class MockBackend extends FakeBackend {}

/** A user with several roles gets the example of the most powerful one. */
const ROLE_PRIORITY = [
  'SUPER_ADMIN',
  'ADMIN',
  'INSTRUCTOR',
  'REPORT_VIEWER',
  'LEARNER',
];

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
      const value = req.params.get(key);
      return value === null ? [] : [[key, value] as const];
    }),
  );
}

/**
 * Dev only: answers a request from the mock API instead of the network. The endpoint comes from
 * the `ENDPOINT` context `EndpointClient` sets, and is looked up by object:
 *
 * - an endpoint declared `served: 'mock'` (the backend lacks it) answers its static examples
 *   (`MOCK_FIXTURES`): the body for the role of the signed-in demo user, or the default one, in
 *   the backend's envelope (HTTP 200);
 * - with `mockBackend`, an endpoint the backend has is answered by the seeded in-memory backend
 *   with the real HTTP status and envelope. A 4xx or 5xx is thrown as an `HttpErrorResponse`,
 *   which is how the browser reports it, and `envelopeInterceptor` reads the envelope from it;
 * - anything else goes on to the network, with one warning per endpoint.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const endpoint = req.context.get(ENDPOINT);
  const backend = inject(MockBackend);
  const fixture =
    endpoint?.served === 'mock' ? MOCK_FIXTURES.get(endpoint) : undefined;
  if (endpoint && fixture) {
    const held = backend.roleCodesOf(bearerOf(req));
    const role = ROLE_PRIORITY.find(
      (code) => held.includes(code) && fixture.roles?.[code] !== undefined,
    );
    const body = (role ? fixture.roles?.[role] : undefined) ?? fixture.default;
    return of(new HttpResponse({ status: 200, body: envelopeOk(body) }));
  }
  if (endpoint && inject(APP_CONFIG).mockBackend && backend.answers(endpoint)) {
    const request: FakeRequest = {
      token: bearerOf(req),
      params: paramsOf(endpoint, req),
      query: queryOf(req),
      body: req.body,
    };
    const reply = backend.handle(endpoint, request);
    if (reply) {
      return reply.status < 400
        ? of(new HttpResponse({ status: reply.status, body: reply.body }))
        : throwError(
            () =>
              new HttpErrorResponse({
                status: reply.status,
                error: reply.body,
                url: req.url,
              }),
          );
    }
  }
  warnOnce(
    endpoint ?? req.url,
    `Mock API: no mock for ${endpoint ? `${endpoint.method.toUpperCase()} ${endpoint.path}` : req.url}; sending it to the network.`,
  );
  return next(req);
};
