import { HttpClient, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { healthEndpoints, toUrl, type Health } from '@lms/contracts';
import { healthOk } from '@lms/mocks';
import { ContractError } from './contract-error';
import { parseResponse } from './parse-response';

function callHealth() {
  const endpoint = healthEndpoints.health;
  const http = TestBed.inject(HttpClient);
  return http
    .get<unknown>(toUrl(endpoint))
    .pipe(parseResponse(endpoint.response));
}

describe('parseResponse (health call)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('emits the parsed body on a matching response', () => {
    let result: Health | undefined;
    callHealth().subscribe((value) => (result = value));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/health')
      .flush(healthOk);
    expect(result).toEqual({ status: 'ok' });
  });

  it('throws a ContractError with the zod issues on a mismatch', () => {
    let error: unknown;
    callHealth().subscribe({ error: (e: unknown) => (error = e) });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/health')
      .flush({ status: 'down' });
    expect(error).toBeInstanceOf(ContractError);
    expect((error as ContractError).issues[0]?.path).toEqual(['status']);
  });
});
