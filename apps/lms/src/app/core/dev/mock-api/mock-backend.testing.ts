import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { authV1Endpoints } from '@lms/contracts';
import { SEED_PASSWORD } from '@lms/mocks';
import { bearerInterceptor } from '../../http/bearer.interceptor';
import { envelopeInterceptor } from '../../http/envelope.interceptor';
import { TokenStore } from '../../session/token-store';
import { mockApiInterceptor, MockBackend } from './mock-api.interceptor';

/**
 * `HttpClient` for screen specs that run against the seeded in-memory backend, the way the dev
 * server does: envelope, bearer and the mock API interceptors, in the app's order, and every
 * call answered synchronously by `MockBackend`. Pair it with `testAppConfig({ mockApi: true,
 * mockBackend: true })`, then call `signInToMockBackend`.
 */
export function provideMockBackendHttp(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([
        envelopeInterceptor,
        bearerInterceptor,
        mockApiInterceptor,
      ]),
    ),
    provideHttpClientTesting(),
  ];
}

/** Signs a seed user in on the backend and stores the token the bearer interceptor sends. */
export function signInToMockBackend(username: string): string {
  const reply = TestBed.inject(MockBackend).handle(authV1Endpoints.login, {
    token: null,
    params: {},
    query: {},
    body: { username, password: SEED_PASSWORD },
  });
  const token = (
    reply?.body as { data: { accessToken: string; expiresInSeconds: number } }
  ).data;
  TestBed.inject(TokenStore).save(token.accessToken, token.expiresInSeconds);
  return token.accessToken;
}
