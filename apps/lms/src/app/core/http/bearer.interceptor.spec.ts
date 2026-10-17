import {
  HttpClient,
  HttpContext,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authV1Endpoints } from '@lms/contracts';
import { storeToken } from '../session/session.testing';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';
import { bearerInterceptor } from './bearer.interceptor';
import { ENDPOINT } from './endpoint-client';
import { provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';

describe('bearerInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(
          testAppConfig({ apiBaseUrl: 'https://api.example.test' }),
        ),
        provideHttpClient(
          withInterceptors([bearerInterceptor, apiBaseUrlInterceptor]),
        ),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('adds the bearer header to an /api/ request while a token is stored', () => {
    storeToken();
    http.get('/api/courses').subscribe();
    const request = backend.expectOne('https://api.example.test/api/courses');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer test-token',
    );
    request.flush([]);
  });

  it('sends no header without a token', () => {
    http.get('/api/courses').subscribe();
    const request = backend.expectOne('https://api.example.test/api/courses');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush([]);
  });

  it('leaves the login request without a header', () => {
    storeToken();
    http
      .post(
        '/api/v1/auth/login',
        {},
        {
          context: new HttpContext().set(ENDPOINT, authV1Endpoints.login),
        },
      )
      .subscribe();
    const request = backend.expectOne(
      'https://api.example.test/api/v1/auth/login',
    );
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it.each(['/assets/i18n/vi.json', 'https://other.example.test/api/x'])(
    'never sends the token to %s',
    (url) => {
      storeToken();
      http.get(url).subscribe();
      const request = backend.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    },
  );
});
