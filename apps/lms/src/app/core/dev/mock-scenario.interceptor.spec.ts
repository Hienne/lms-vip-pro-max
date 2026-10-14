import {
  HttpClient,
  type HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { endpointRegistries } from '@lms/contracts';
import { endpointExamples } from '@lms/mocks';
import { NetworkStore } from '../network/network.store';
import { MockScenario } from './mock-scenario';
import {
  mockScenarioInterceptor,
  ROLE_EXAMPLE_ENDPOINTS,
} from './mock-scenario.interceptor';

describe('mockScenarioInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let scenario: MockScenario;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([mockScenarioInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    scenario = TestBed.inject(MockScenario);
  });
  afterEach(() => backend.verify());

  it('adds nothing until a role is chosen', () => {
    http.get('/api/auth/profile').subscribe();
    const request = backend.expectOne('/api/auth/profile');
    expect(request.request.headers.has('Prefer')).toBe(false);
    request.flush({});
  });

  it.each(['/api/auth/profile', '/api/me/nav-counts'])(
    'asks Prism for the chosen role on %s',
    (url) => {
      scenario.setRole('unit-admin');
      http.get(url).subscribe();
      const request = backend.expectOne(url);
      expect(request.request.headers.get('Prefer')).toBe('example=unit-admin');
      request.flush({});
    },
  );

  it('keeps the header off endpoints and methods without role examples', () => {
    scenario.setRole('admin');
    http.get('/api/auth/demo-accounts').subscribe();
    http.post('/api/auth/profile', {}).subscribe();
    for (const request of backend.match(() => true)) {
      expect(request.request.headers.has('Prefer')).toBe(false);
      request.flush({});
    }
  });

  it('matches the path when the API sits on another origin', () => {
    scenario.setRole('viewer');
    http.get('https://api.example.test/api/auth/profile').subscribe();
    const request = backend.expectOne(
      'https://api.example.test/api/auth/profile',
    );
    expect(request.request.headers.get('Prefer')).toBe('example=viewer');
    request.flush({});
  });

  it('keeps the chosen role for the tab', () => {
    scenario.setRole('instructor');
    TestBed.resetTestingModule();
    expect(TestBed.inject(MockScenario).role$()).toBe('instructor');
    TestBed.inject(MockScenario).setRole(null);
    expect(sessionStorage.getItem('lms.mockRole')).toBeNull();
  });

  it('fails every request like a dead network while offline is simulated', () => {
    TestBed.inject(NetworkStore).goOffline();
    let error: HttpErrorResponse | undefined;
    http.get('/api/auth/profile').subscribe({ error: (e) => (error = e) });
    expect(error?.status).toBe(0);
    backend.expectNone('/api/auth/profile');
    TestBed.inject(NetworkStore).goOnline();
    http.get('/api/auth/profile').subscribe();
    backend.expectOne('/api/auth/profile').flush({});
  });

  it('lists exactly the endpoints that have role examples', () => {
    const withRoles = endpointRegistries
      .flatMap((registry) => Object.entries(registry))
      .filter(([operation]) => endpointExamples[operation]?.roles)
      .map(([operation]) => operation)
      .sort();
    expect(Object.keys(ROLE_EXAMPLE_ENDPOINTS).sort()).toEqual(withRoles);
  });
});
