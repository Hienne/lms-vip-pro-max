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
import { provideAppConfig } from '../config/app-config';
import { apiBaseUrlInterceptor } from './api-base-url.interceptor';

function setup(apiBaseUrl: string) {
  TestBed.configureTestingModule({
    providers: [
      provideAppConfig({
        name: 'staging',
        production: true,
        apiBaseUrl,
        mockApi: false,
        devTools: false,
      }),
      provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
  };
}

describe('apiBaseUrlInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('prefixes /api requests with apiBaseUrl', () => {
    const { http, backend } = setup('https://api.example.test');
    http.get('/api/courses').subscribe();
    backend.expectOne('https://api.example.test/api/courses').flush([]);
  });

  it('keeps /api requests same-origin when apiBaseUrl is empty', () => {
    const { http, backend } = setup('');
    http.get('/api/courses').subscribe();
    backend.expectOne('/api/courses').flush([]);
  });

  it('leaves non-API URLs untouched', () => {
    const { http, backend } = setup('https://api.example.test');
    http.get('/assets/i18n/vi.json').subscribe();
    backend.expectOne('/assets/i18n/vi.json').flush({});
  });
});
