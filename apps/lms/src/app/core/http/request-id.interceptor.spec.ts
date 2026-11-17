import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { requestIdInterceptor } from './request-id.interceptor';

/** What the backend accepts: 1 to 64 characters, starting with a letter or digit. */
const ACCEPTED = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

describe('requestIdInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('sends a valid X-Request-Id on an API call, a new one each time', () => {
    http.get('/api/v1/users').subscribe();
    http.get('/api/v1/users').subscribe();
    const ids = backend
      .match('/api/v1/users')
      .map((request) => request.request.headers.get('X-Request-Id'));
    expect(ids[0]).toMatch(ACCEPTED);
    expect(ids[1]).toMatch(ACCEPTED);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('leaves other URLs alone', () => {
    http.get('/assets/logo.svg').subscribe();
    const request = backend.expectOne('/assets/logo.svg');
    expect(request.request.headers.has('X-Request-Id')).toBe(false);
  });
});
