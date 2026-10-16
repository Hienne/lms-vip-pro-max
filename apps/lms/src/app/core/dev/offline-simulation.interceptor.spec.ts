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
import { NetworkStore } from '../network/network.store';
import { offlineSimulationInterceptor } from './offline-simulation.interceptor';

describe('offlineSimulationInterceptor', () => {
  it('fails every request like a dead network while offline is simulated', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([offlineSimulationInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    TestBed.inject(NetworkStore).goOffline();
    let error: HttpErrorResponse | undefined;
    http.get('/api/auth/profile').subscribe({ error: (e) => (error = e) });
    expect(error?.status).toBe(0);
    backend.expectNone('/api/auth/profile');
    TestBed.inject(NetworkStore).goOnline();
    http.get('/api/auth/profile').subscribe();
    backend.expectOne('/api/auth/profile').flush({});
    backend.verify();
  });
});
