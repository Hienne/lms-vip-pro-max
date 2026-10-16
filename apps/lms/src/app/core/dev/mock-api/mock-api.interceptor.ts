import { HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MOCK_FIXTURES } from '@lms/mocks';
import { of } from 'rxjs';
import { ENDPOINT } from '../../http/endpoint-client';
import { MockScenario } from '../mock-scenario';

const warned = new Set<unknown>();

function warnOnce(key: unknown, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/**
 * Dev only: answers a request with its endpoint's fixture, `roles[role] ?? default`, where
 * `role` is the one chosen in the dev toolbar. The endpoint comes from the `ENDPOINT` context
 * `EndpointClient` sets, and is looked up by object. Stateless: no delay, no error simulation.
 * A request without a fixture goes on to the network, with one warning per endpoint.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const endpoint = req.context.get(ENDPOINT);
  const fixture = endpoint ? MOCK_FIXTURES.get(endpoint) : undefined;
  if (!fixture) {
    warnOnce(
      endpoint ?? req.url,
      `Mock API: no fixture for ${endpoint ? `${endpoint.method.toUpperCase()} ${endpoint.path}` : req.url}; sending it to the network.`,
    );
    return next(req);
  }
  const role = inject(MockScenario).role$();
  const body = (role ? fixture.roles?.[role] : undefined) ?? fixture.default;
  return of(new HttpResponse({ status: 200, body }));
};
