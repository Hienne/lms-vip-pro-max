import {
  HttpClient,
  HttpContext,
  type HttpErrorResponse,
  HttpParams,
  type HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  adminOrgEndpoints,
  type AnyEndpoint,
  authV1Endpoints,
  defineEndpoint,
  EnvelopeSchema,
  identityEndpoints,
  knowledgeEndpoints,
  shellEndpoints,
} from '@lms/contracts';
import { navCountsFixtures, SEED_PASSWORD } from '@lms/mocks';
import { z } from 'zod';
import { parseAppConfig, provideAppConfig } from '../../config/app-config';
import { testAppConfig } from '../../config/app-config.testing';
import { ENDPOINT } from '../../http/endpoint-client';
import { NetworkStore } from '../../network/network.store';
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

  const configure = (mockBackend: boolean) => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend })),
        ),
        provideHttpClient(
          withInterceptors([offlineSimulationInterceptor, mockApiInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  };

  const ask = (
    endpoint: AnyEndpoint,
    url: string,
    options: { body?: unknown; token?: string } = {},
  ) =>
    http.request(endpoint.method, url, {
      body: options.body,
      headers: options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {},
      observe: 'response',
      context: new HttpContext().set(ENDPOINT, endpoint),
    });

  function signIn(username: string): string {
    let token = '';
    ask(authV1Endpoints.login, authV1Endpoints.login.path, {
      body: { username, password: SEED_PASSWORD },
    }).subscribe(
      (response) =>
        (token = (
          EnvelopeSchema.parse(response.body).data as {
            accessToken: string;
          }
        ).accessToken),
    );
    return token;
  }

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    backend.verify();
    warn.mockRestore();
  });

  describe('with the mock backend', () => {
    beforeEach(() => configure(true));

    it('answers a mock-only endpoint with its default example, as HTTP 200', () => {
      let status: number | undefined;
      let body: unknown;
      ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe((r) => {
        status = r.status;
        body = r.body;
      });
      expect(status).toBe(200);
      expect(EnvelopeSchema.parse(body)).toMatchObject({
        status: 'SUCCESS',
        messageCode: 'CORE-SUCCESS',
        data: navCountsFixtures['LEARNER'],
      });
      backend.expectNone('/api/me/nav-counts');
    });

    it('answers a streamed endpoint with NDJSON text, one event per line', () => {
      const token = signIn('hocvien');
      let response: HttpResponse<unknown> | undefined;
      ask(knowledgeEndpoints.askStream, knowledgeEndpoints.askStream.path, {
        token,
        body: { question: 'EOD là gì?' },
      }).subscribe((r) => (response = r));
      expect(response?.headers.get('Content-Type')).toBe(
        'application/x-ndjson',
      );
      const lines = String(response?.body).trimEnd().split('\n');
      expect(lines.map((l) => JSON.parse(l).type)).toEqual([
        'retrieved',
        'delta',
        'delta',
        'delta',
        'delta',
        'delta',
        'done',
      ]);
    });

    it('joins a repeated query key so the mock sees every value', () => {
      const token = signIn('hocvien');
      let body: unknown;
      http
        .get(knowledgeEndpoints.documents.path, {
          params: new HttpParams()
            .append('status', 'failed')
            .append('status', 'ready'),
          headers: { Authorization: `Bearer ${token}` },
          context: new HttpContext().set(
            ENDPOINT,
            knowledgeEndpoints.documents,
          ),
        })
        .subscribe((b) => (body = b));
      const ids = (
        EnvelopeSchema.parse(body).data as { items: { id: number }[] }
      ).items.map((d) => d.id);
      expect(ids).toEqual([3, 1]);
    });

    it('answers a mock-only endpoint with the example of the signed-in role', () => {
      const token = signIn('giangvien');
      let body: unknown;
      ask(shellEndpoints.navCounts, '/api/me/nav-counts', { token }).subscribe(
        (r) => (body = r.body),
      );
      expect(EnvelopeSchema.parse(body).data).toEqual(
        navCountsFixtures['INSTRUCTOR'],
      );
    });

    it('keeps a saved role: the next list shows it', () => {
      const answer = (endpoint: AnyEndpoint, body?: unknown) => {
        let data: unknown;
        ask(endpoint, endpoint.path, { body }).subscribe(
          (r) => (data = EnvelopeSchema.parse(r.body).data),
        );
        return data as { name: string }[] & { name: string };
      };
      answer(adminOrgEndpoints.saveRole, {
        name: 'Kiểm soát',
        description: '',
        menus: ['PROFILE'],
      });
      expect(
        answer(adminOrgEndpoints.roles).map((role) => role.name),
      ).toContain('Kiểm soát');
    });

    it('answers a backend endpoint from the seed with its real status', () => {
      const token = signIn('hocvien');
      let body: unknown;
      ask(authV1Endpoints.me, authV1Endpoints.me.path, { token }).subscribe(
        (r) => (body = r.body),
      );
      expect(EnvelopeSchema.parse(body).data).toMatchObject({
        user: { userId: '000004', mustChangePassword: false },
      });
    });

    it('throws a refusal as an HttpErrorResponse carrying the envelope', () => {
      let error: HttpErrorResponse | undefined;
      ask(authV1Endpoints.me, authV1Endpoints.me.path).subscribe({
        error: (e) => (error = e),
      });
      expect(error?.status).toBe(401);
      expect(EnvelopeSchema.parse(error?.error).messageCode).toBe(
        'CORE-UNAUTHENTICATED',
      );
    });

    it('reads path params and query from the request', () => {
      const token = signIn('super.admin');
      let body: unknown;
      ask(
        identityEndpoints.getUser,
        identityEndpoints.getUser.path.replace('{userId}', '000004'),
        { token },
      ).subscribe((r) => (body = r.body));
      expect(EnvelopeSchema.parse(body).data).toMatchObject({
        user: { userId: '000004' },
      });
    });

    it('sends an endpoint without a mock to the network and warns once', () => {
      ask(unmocked, '/api/unmocked').subscribe();
      ask(unmocked, '/api/unmocked').subscribe();
      for (const request of backend.match('/api/unmocked')) request.flush({});
      expect(warn).toHaveBeenCalledTimes(1);
    });

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

  describe('without the mock backend', () => {
    beforeEach(() => configure(false));

    it.each([
      ...Object.entries(authV1Endpoints),
      ...Object.entries(identityEndpoints),
    ])('sends the backend endpoint %s to the network', (_name, endpoint) => {
      ask(endpoint, endpoint.path).subscribe({ error: () => undefined });
      backend.expectOne(endpoint.path).flush({});
    });

    it('still answers the mock-only endpoints', () => {
      let body: unknown;
      ask(shellEndpoints.navCounts, '/api/me/nav-counts').subscribe(
        (r) => (body = r.body),
      );
      expect(EnvelopeSchema.parse(body).status).toBe('SUCCESS');
      backend.expectNone('/api/me/nav-counts');
    });
  });
});
