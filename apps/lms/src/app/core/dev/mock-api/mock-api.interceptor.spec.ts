import {
  HttpClient,
  HttpContext,
  type HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  authV1Endpoints,
  defineEndpoint,
  EnvelopeSchema,
  shellEndpoints,
} from '@lms/contracts';
import { navCountsFixtures } from '@lms/mocks';
import { z } from 'zod';
import { ENDPOINT } from '../../http/endpoint-client';
import { NetworkStore } from '../../network/network.store';
import { MockScenario } from '../mock-scenario';
import { offlineSimulationInterceptor } from '../offline-simulation.interceptor';
import { mockApiInterceptor } from './mock-api.interceptor';

const unmocked = defineEndpoint({
  method: 'get',
  path: '/api/unmocked',
  response: z.unknown(),
});

describe('mockApiInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let warn: ReturnType<typeof vi.spyOn>;

  const ask = (endpoint: Parameters<HttpContext['set']>[1], url: string) =>
    http.get(url, { context: new HttpContext().set(ENDPOINT, endpoint) });

  beforeEach(() => {
    sessionStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([offlineSimulationInterceptor, mockApiInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    backend.verify();
    warn.mockRestore();
  });

  it('answers a tagged request with the default example', () => {
    let body: unknown;
    ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe(
      (b) => (body = b),
    );
    expect(EnvelopeSchema.parse(body)).toMatchObject({
      status: 'SUCCESS',
      messageCode: 'CORE-SUCCESS',
      data: navCountsFixtures['learner'],
    });
    backend.expectNone('/api/me/nav-counts');
  });

  it('answers HTTP 200', () => {
    let status: number | undefined;
    http
      .get('/api/me/nav-counts', {
        observe: 'response',
        context: new HttpContext().set(ENDPOINT, shellEndpoints.navCounts),
      })
      .subscribe((response) => (status = response.status));
    expect(status).toBe(200);
  });

  it('answers with the example of the role chosen in the toolbar', () => {
    TestBed.inject(MockScenario).setRole('admin');
    let body: unknown;
    ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe(
      (b) => (body = b),
    );
    expect(EnvelopeSchema.parse(body).data).toEqual(navCountsFixtures['admin']);
  });

  it('falls back to the default when the role has no example', () => {
    TestBed.inject(MockScenario).setRole('custom-role');
    let body: unknown;
    ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe(
      (b) => (body = b),
    );
    expect(EnvelopeSchema.parse(body).data).toEqual(
      navCountsFixtures['learner'],
    );
  });

  it('sends an endpoint without a fixture to the network and warns once', () => {
    ask(unmocked, '/api/unmocked').subscribe();
    ask(unmocked, '/api/unmocked').subscribe();
    for (const request of backend.match('/api/unmocked')) request.flush({});
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries(authV1Endpoints))(
    'sends the backend auth endpoint %s to the network',
    (_name, endpoint) => {
      ask(endpoint, endpoint.path).subscribe({ error: () => undefined });
      backend.expectOne(endpoint.path).flush({});
    },
  );

  it('sends an untagged request to the network and warns once', () => {
    http.get('/api/untagged').subscribe();
    http.get('/api/untagged').subscribe();
    for (const request of backend.match('/api/untagged')) request.flush({});
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('lets the offline simulation win over the mock', () => {
    TestBed.inject(NetworkStore).goOffline();
    let error: HttpErrorResponse | undefined;
    ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe({
      error: (e) => (error = e),
    });
    expect(error?.status).toBe(0);
  });
});
