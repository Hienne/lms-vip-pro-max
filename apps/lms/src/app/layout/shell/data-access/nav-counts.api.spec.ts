import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { navCountsFixtures } from '@lms/mocks';
import { NavCountsApi } from './nav-counts.api';

describe('NavCountsApi', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('gets the counts of the signed-in user', () => {
    let counts: unknown;
    TestBed.inject(NavCountsApi)
      .navCounts()
      .subscribe((c) => (counts = c));
    backend.expectOne('/api/me/nav-counts').flush(navCountsFixtures['admin']);
    expect(counts).toEqual({ notifications: 1, inbox: 3 });
  });

  it('rejects a response that breaks the contract', () => {
    let error: unknown;
    TestBed.inject(NavCountsApi)
      .navCounts()
      .subscribe({ error: (e: unknown) => (error = e) });
    backend.expectOne('/api/me/nav-counts').flush({ notifications: -1 });
    expect(error).toBeDefined();
  });
});
