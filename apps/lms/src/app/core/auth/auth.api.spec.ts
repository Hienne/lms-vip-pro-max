import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  demoAccountFixtures,
  loginDemoLocked,
  loginInvalid,
  loginLocked,
  loginResult,
  loginUnauthorized,
  profileFixtures,
  profileUnauthorized,
} from '@lms/mocks';
import type { Observable } from 'rxjs';
import { type AppError, toAppError } from '../errors/app-error';
import { AuthApi } from './auth.api';

describe('AuthApi', () => {
  let api: AuthApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApi);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  function result<T>(call: Observable<T>): { value?: T; error?: unknown } {
    const out: { value?: T; error?: unknown } = {};
    call.subscribe({
      next: (v) => (out.value = v),
      error: (e: unknown) => (out.error = e),
    });
    return out;
  }

  it('login posts the command and returns the parsed result', () => {
    const out = result(
      api.login({ email: 'hocvien@demo.cb', password: 'abc123' }),
    );
    const req = backend.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'hocvien@demo.cb',
      password: 'abc123',
    });
    req.flush(loginResult);
    expect(out.value).toEqual(loginResult);
  });

  it('loginDemo posts to the demo account url', () => {
    const out = result(api.loginDemo('a1'));
    const req = backend.expectOne('/api/auth/demo-accounts/a1/login');
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'a1', roleId: 'admin' });
    expect(out.value).toEqual({ id: 'a1', roleId: 'admin' });
  });

  it('logout posts and returns true', () => {
    const out = result(api.logout());
    const req = backend.expectOne('/api/auth/logout');
    expect(req.request.method).toBe('POST');
    req.flush(true);
    expect(out.value).toBe(true);
  });

  it('profile gets the signed-in user', () => {
    const out = result(api.profile());
    const req = backend.expectOne('/api/auth/profile');
    expect(req.request.method).toBe('GET');
    req.flush(profileFixtures['admin']);
    expect(out.value).toEqual(profileFixtures['admin']);
  });

  it('demoAccounts gets the list', () => {
    const out = result(api.demoAccounts());
    backend.expectOne('/api/auth/demo-accounts').flush(demoAccountFixtures);
    expect(out.value).toEqual(demoAccountFixtures);
  });

  it('keeps the 422 field details', () => {
    const out = result(api.login({ email: '', password: '' }));
    backend
      .expectOne('/api/auth/login')
      .flush(loginInvalid, { status: 422, statusText: 'Unprocessable' });
    expect(toAppError(out.error)).toEqual<AppError>({
      kind: 'invalid',
      message: loginInvalid.message,
      details: loginInvalid.details,
    });
  });

  it.each([
    ['login 423', loginLocked, 423, 'locked'],
    ['login 401', loginUnauthorized, 401, 'unauthorized'],
    ['profile 401', profileUnauthorized, 401, 'unauthorized'],
    ['loginDemo 423', loginDemoLocked, 423, 'locked'],
  ] as const)('%s maps to %s', (_, body, status, kind) => {
    const call = _.startsWith('profile')
      ? api.profile()
      : _.startsWith('loginDemo')
        ? api.loginDemo('l8')
        : api.login({ email: 'long.pd@demo.cb', password: 'abc123' });
    const out = result(call);
    backend.match(() => true)[0].flush(body, { status, statusText: 'Error' });
    expect(toAppError(out.error)).toEqual({ kind, message: body.message });
  });

  it('reports a response that breaks the contract', () => {
    const out = result(api.profile());
    backend.expectOne('/api/auth/profile').flush({ id: 'a1' });
    expect(toAppError(out.error).kind).toBe('contract');
  });
});
