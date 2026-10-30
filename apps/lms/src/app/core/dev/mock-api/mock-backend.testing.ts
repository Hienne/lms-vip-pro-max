import {
  provideHttpClient,
  withInterceptors,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  inject,
  Injectable,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { authV1Endpoints, type AnyEndpoint } from '@lms/contracts';
import { SEED_PASSWORD } from '@lms/mocks';
import { Observable, throwError } from 'rxjs';
import { bearerInterceptor } from '../../http/bearer.interceptor';
import { ENDPOINT } from '../../http/endpoint-client';
import { envelopeInterceptor } from '../../http/envelope.interceptor';
import { TokenStore } from '../../session/token-store';
import { mockApiInterceptor, MockBackend } from './mock-api.interceptor';

/** A hold on the replies to one endpoint: its requests stay open until the spec releases them. */
export interface ReplyHold {
  /** Requests waiting for their reply. */
  pending(): number;
  /** Answers the oldest waiting request. */
  releaseNext(): void;
  /** Answers the newest waiting request, so a later request can land before an earlier one. */
  releaseLast(): void;
  /** Answers every waiting request and stops holding. */
  release(): void;
}

interface Waiting {
  release(): void;
}

/**
 * Lets a spec hold the reply to an endpoint and release it later, to test what happens while a
 * request is still in flight. A held request reaches the mock backend only when it is released.
 */
@Injectable({ providedIn: 'root' })
export class ReplyGate {
  private readonly holds = new Map<AnyEndpoint, Waiting[]>();

  hold(endpoint: AnyEndpoint): ReplyHold {
    const waiting: Waiting[] = [];
    this.holds.set(endpoint, waiting);
    return {
      pending: () => waiting.length,
      releaseNext: () => waiting.shift()?.release(),
      releaseLast: () => waiting.pop()?.release(),
      release: () => {
        this.holds.delete(endpoint);
        for (const request of waiting.splice(0)) request.release();
      },
    };
  }

  /** The requests waiting on `endpoint`, or none when it is not held. */
  waitingOn(endpoint: AnyEndpoint | null): Waiting[] | undefined {
    return endpoint ? this.holds.get(endpoint) : undefined;
  }
}

/** Holds the request of a held endpoint until `ReplyGate` releases it; a caller who gives up is forgotten. */
const holdInterceptor: HttpInterceptorFn = (req, next) => {
  const waiting = inject(ReplyGate).waitingOn(req.context.get(ENDPOINT));
  if (!waiting) return next(req);
  return new Observable((subscriber) => {
    let inner: { unsubscribe(): void } | undefined;
    const entry: Waiting = {
      release: () => {
        inner = next(req).subscribe(subscriber);
      },
    };
    waiting.push(entry);
    return () => {
      const at = waiting.indexOf(entry);
      if (at >= 0) waiting.splice(at, 1);
      inner?.unsubscribe();
    };
  });
};

/**
 * Last in the chain: a request neither the mock API nor a spec answered would otherwise wait for
 * an `HttpTestingController` nobody drives, and the spec would hang until its timeout.
 */
const failUnmockedInterceptor: HttpInterceptorFn = (req) => {
  const endpoint = req.context.get(ENDPOINT);
  const name = endpoint
    ? `${endpoint.method.toUpperCase()} ${endpoint.path}`
    : req.url;
  return throwError(() => new Error(`Unmocked request: ${name}`));
};

/**
 * `HttpClient` for screen specs that run against the seeded in-memory backend, the way the dev
 * server does: envelope, bearer and the mock API interceptors, in the app's order, and every
 * call answered synchronously by `MockBackend`, unless a spec holds it with `ReplyGate`. A call
 * the backend does not answer fails at once with "Unmocked request: <METHOD path>". Pair it with
 * `testAppConfig({ mockApi: true, mockBackend: true })`, then call `signInToMockBackend`.
 */
export function provideMockBackendHttp(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([
        envelopeInterceptor,
        bearerInterceptor,
        holdInterceptor,
        mockApiInterceptor,
        failUnmockedInterceptor,
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
