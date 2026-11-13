import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authV1Endpoints, identityEndpoints } from '@lms/contracts';
import { backendRefusal, envelopeError } from '@lms/mocks';
import { Toaster } from '@lms/ui';
import { SESSION_EXPIRED_MESSAGE } from '../errors/app-error';
import type { Profile } from '../session/profile';
import { SessionStore } from '../session/session.store';
import { seedProfile } from '../session/session.testing';
import { EndpointClient } from './endpoint-client';
import { provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from './http.testing';
import { sessionExpiryInterceptor } from './session-expiry.interceptor';
import { SESSION_ENDED_STATE } from '../routing/unsaved-changes.guard';

class FakeSession {
  readonly user = signal<Profile | null>(seedProfile('000004'));
  readonly isSignedIn$ = () => this.user() !== null;
  expire = vi.fn(() => this.user.set(null));
}

describe('sessionExpiryInterceptor', async () => {
  let session: FakeSession;
  let client: EndpointClient;
  let backend: HttpTestingController;
  let router: Router;
  let toaster: Toaster;

  // The interceptor loads SessionExpiry on demand; warm that import so the first
  // test does not race the 20 ms settle when the whole suite runs under load.
  beforeAll(() => import('../session/session-expiry'));

  beforeEach(() => {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig()),
        provideEnvelopeHttpClient(sessionExpiryInterceptor),
        provideRouter([]),
        { provide: SessionStore, useValue: session },
      ],
    });
    client = TestBed.inject(EndpointClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    toaster = TestBed.inject(Toaster);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/catalog?q=a');
    vi.spyOn(toaster, 'info');
  });
  afterEach(() => backend.verify());

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const fail = (status: number) => ({ status, statusText: 'x' });

  it('ends the session on a 401 and still fails the caller', async () => {
    const errors: unknown[] = [];
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: (e) => errors.push(e) });
    backend.expectOne(() => true).flush({ message: 'no' }, fail(401));
    await settle();

    expect(errors).toHaveLength(1);
    expect(session.expire).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/catalog?q=a' },
      state: { [SESSION_ENDED_STATE]: true },
    });
    expect(toaster.info).toHaveBeenCalledExactlyOnceWith(
      SESSION_EXPIRED_MESSAGE,
    );
  });

  it('ends the session on a 401 carrying the CORE-UNAUTHENTICATED envelope and still fails the caller', async () => {
    const errors: unknown[] = [];
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: (e) => errors.push(e) });
    backend
      .expectOne(() => true)
      .flush(backendRefusal('unauthenticated').body, fail(401));
    await settle();

    expect(errors).toHaveLength(1);
    expect(session.expire).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/catalog?q=a' },
      state: { [SESSION_ENDED_STATE]: true },
    });
    expect(toaster.info).toHaveBeenCalledExactlyOnceWith(
      SESSION_EXPIRED_MESSAGE,
    );
  });

  it('ends the session on a 401 envelope with a code the app does not list', async () => {
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: () => undefined });
    backend
      .expectOne(() => true)
      .flush(
        envelopeError('CORE-TOKEN_REVOKED', 'Hết hạn', 'Thu hồi'),
        fail(401),
      );
    await settle();
    expect(session.expire).toHaveBeenCalledOnce();
  });

  it.each([
    ['me', authV1Endpoints.me],
    ['login', authV1Endpoints.login],
    ['logout', authV1Endpoints.logout],
  ])('leaves a 401 envelope on %s alone', async (_name, endpoint) => {
    client
      .call(...([endpoint, { body: {} }] as unknown as [never]))
      .subscribe({ error: () => undefined });
    backend
      .expectOne(() => true)
      .flush(backendRefusal('credentialsInvalid').body, fail(401));
    await settle();
    expect(session.expire).not.toHaveBeenCalled();
  });

  it('ignores an ERROR envelope with any other code', async () => {
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: () => undefined });
    backend
      .expectOne(() => true)
      .flush(envelopeError('CORE-0500', 'Lỗi', 'Có lỗi'));
    await settle();
    expect(session.expire).not.toHaveBeenCalled();
  });

  it('reports a burst of 401s once', async () => {
    for (let i = 0; i < 3; i++) {
      client
        .call(identityEndpoints.listRoles)
        .subscribe({ error: () => undefined });
    }
    backend.match(() => true).forEach((r) => r.flush({}, fail(401)));
    await settle();

    expect(session.expire).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledOnce();
    expect(toaster.info).toHaveBeenCalledOnce();
  });

  it.each([
    ['me', authV1Endpoints.me],
    ['login', authV1Endpoints.login],
    ['logout', authV1Endpoints.logout],
  ])('leaves a 401 on %s alone', async (_name, endpoint) => {
    client
      .call(...([endpoint, { body: {} }] as unknown as [never]))
      .subscribe({ error: () => undefined });
    backend.expectOne(() => true).flush({}, fail(401));
    await settle();
    expect(session.expire).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does nothing when the visitor is already anonymous', async () => {
    session.user.set(null);
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: () => undefined });
    backend.expectOne(() => true).flush({}, fail(401));
    await settle();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])('ignores a %s', async (status) => {
    client
      .call(identityEndpoints.listRoles)
      .subscribe({ error: () => undefined });
    backend.expectOne(() => true).flush({}, fail(status));
    await settle();
    expect(session.expire).not.toHaveBeenCalled();
  });

  it('also handles a request made without an endpoint', async () => {
    TestBed.inject(HttpClient)
      .get('/api/x')
      .subscribe({ error: () => undefined });
    backend.expectOne('/api/x').flush({}, fail(401));
    await settle();
    expect(session.expire).toHaveBeenCalledOnce();
  });
});
