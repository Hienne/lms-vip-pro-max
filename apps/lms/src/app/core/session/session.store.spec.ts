import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { backendRefusal, envelopeOk, seedMe } from '@lms/mocks';
import { bearerInterceptor } from '../http/bearer.interceptor';
import { provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SessionStore } from './session.store';
import { storeToken, ME_URL } from './session.testing';
import { TokenStore } from './token-store';

const LOGIN_URL = '/api/v1/auth/login';
const UNAUTHORIZED = { status: 401, statusText: 'Unauthorized' };

const loginData = {
  accessToken: 'fixture.jwt.token',
  tokenType: 'Bearer',
  expiresInSeconds: 3600,
};
const loginV1Body = { ...envelopeOk(loginData), data: loginData };
const logoutV1Body = envelopeOk(null);
/** `/me` of the seed learner (staff code 000004). */
const meV1Body = envelopeOk(seedMe('000004'));

describe('SessionStore', () => {
  let store: SessionStore;
  let tokens: TokenStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(testAppConfig()),
        provideEnvelopeHttpClient(bearerInterceptor),
        SessionStore,
      ],
    });
    store = TestBed.inject(SessionStore);
    tokens = TestBed.inject(TokenStore);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    vi.useRealTimers();
    backend.verify();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  async function restoreWithToken(): Promise<void> {
    storeToken();
    store.restore();
    await settle();
    backend.expectOne(ME_URL).flush(meV1Body);
    await settle();
  }

  describe('restore', () => {
    it('is loading until /me answers, then exposes the user from /me', async () => {
      storeToken();
      expect(store.status$()).toBe('loading');
      store.restore();
      await settle();
      expect(store.status$()).toBe('loading');
      expect(store.isSignedIn$()).toBe(false);

      const request = backend.expectOne(ME_URL);
      expect(request.request.method).toBe('GET');
      request.flush(meV1Body);
      await settle();

      expect(store.status$()).toBe('ready');
      expect(store.isSignedIn$()).toBe(true);
      expect(store.user$()).toMatchObject({
        userId: '000004',
        username: 'hocvien',
        status: 'active',
        mustChangePassword: false,
        homePath: '/learn',
        roleText: 'Học viên',
      });
    });

    it('exposes the functions /me lists as the menus, and the first of them as home', async () => {
      await restoreWithToken();
      expect(store.menus$()).toContain('COURSE_LEARNING');
      expect(store.menus$()).not.toContain('USER_MANAGEMENT');
      expect(store.homePath$()).toBe('/learn');
    });

    it('flags a temporary password and sends the user to the password change', async () => {
      storeToken();
      store.restore();
      await settle();
      const me = seedMe('000004');
      backend.expectOne(ME_URL).flush(
        envelopeOk({
          ...me,
          user: { ...me.user, mustChangePassword: true },
        }),
      );
      await settle();

      expect(store.mustChangePassword$()).toBe(true);
      expect(store.homePath$()).toBe('/change-password');
    });

    it('makes no /me call without a token and leaves the visitor anonymous', async () => {
      store.restore();
      await settle();

      backend.expectNone(ME_URL);
      expect(store.status$()).toBe('ready');
      expect(store.isSignedIn$()).toBe(false);
      expect(store.homePath$()).toBeNull();
      expect(store.menus$()).toEqual([]);
    });

    it('drops an expired token without asking /me', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      storeToken(60);
      vi.advanceTimersByTime(61_000);
      store.restore();
      await settle();

      backend.expectNone(ME_URL);
      expect(store.isSignedIn$()).toBe(false);
      expect(tokens.read()).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('treats a 401 from /me as anonymous and removes the token', async () => {
      storeToken();
      store.restore();
      await settle();
      backend.expectOne(ME_URL).flush({}, UNAUTHORIZED);
      await settle();

      expect(store.status$()).toBe('ready');
      expect(store.isSignedIn$()).toBe(false);
      expect(store.loadError$()).toBeUndefined();
      expect(localStorage.length).toBe(0);
    });

    it('reports any other failure, keeps the token and retries on the next restore', async () => {
      storeToken();
      store.restore();
      await settle();
      backend
        .expectOne(ME_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(store.status$()).toBe('error');
      expect(store.loadError$()?.kind).toBe('unknown');
      expect(tokens.read()).not.toBeNull();

      store.restore();
      await settle();
      expect(store.status$()).toBe('loading');
      backend.expectOne(ME_URL).flush(meV1Body);
      await settle();
      expect(store.status$()).toBe('ready');
      expect(store.isSignedIn$()).toBe(true);
    });
  });

  describe('sign in', () => {
    it('posts the credentials, stores the token with its expiry, then loads /me', async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: 1_000_000 });
      store.restore();
      await settle();
      store.signIn({ username: '000123', password: 'secret' });
      await settle();

      expect(store.isSigningIn$()).toBe(true);
      const login = backend.expectOne(LOGIN_URL);
      expect(login.request.method).toBe('POST');
      expect(login.request.body).toEqual({
        username: '000123',
        password: 'secret',
      });
      login.flush(loginV1Body);
      await settle();

      expect(JSON.parse(localStorage.getItem('lms.accessToken') ?? '')).toEqual(
        {
          accessToken: loginV1Body.data.accessToken,
          expiresAt: 1_000_000 + loginV1Body.data.expiresInSeconds * 1000,
        },
      );
      const me = backend.expectOne(ME_URL);
      expect(me.request.headers.get('Authorization')).toBe(
        `Bearer ${loginV1Body.data.accessToken}`,
      );
      me.flush(meV1Body);
      await settle();

      expect(store.isSigningIn$()).toBe(false);
      expect(store.user$()?.fullName).toBe(seedMe('000004').user.fullName);
      expect(store.signInError$()).toBeUndefined();
    });

    it('exposes a failed login and stays anonymous without a token', async () => {
      store.restore();
      await settle();
      store.signIn({ username: 'x', password: 'bad' });
      await settle();
      backend
        .expectOne(LOGIN_URL)
        .flush(backendRefusal('credentialsInvalid').body, UNAUTHORIZED);
      await settle();

      expect(store.signInError$()).toMatchObject({
        kind: 'server',
        messageCode: 'IDENTITY-CREDENTIALS_INVALID',
        message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
      });
      expect(store.isSignedIn$()).toBe(false);
      expect(localStorage.length).toBe(0);
    });

    it('removes the token again when /me fails right after login', async () => {
      store.restore();
      await settle();
      store.signIn({ username: 'x', password: 'y' });
      await settle();
      backend.expectOne(LOGIN_URL).flush(loginV1Body);
      await settle();
      backend
        .expectOne(ME_URL)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(store.signInError$()).toBeDefined();
      expect(store.isSignedIn$()).toBe(false);
      expect(localStorage.length).toBe(0);
    });
  });

  it.each([
    ['succeeds', logoutV1Body, { status: 200, statusText: 'OK' }],
    ['answers 401', {}, UNAUTHORIZED],
  ] as const)(
    'signs out with the bearer header and becomes anonymous when logout %s',
    async (_outcome, body, init) => {
      await restoreWithToken();
      store.signOut();
      await settle();
      expect(store.isSigningOut$()).toBe(true);
      const logout = backend.expectOne('/api/v1/auth/logout');
      expect(logout.request.method).toBe('POST');
      expect(logout.request.headers.get('Authorization')).toBe(
        'Bearer test-token',
      );
      logout.flush(body, init);
      await settle();

      expect(store.isSigningOut$()).toBe(false);
      expect(store.isSignedIn$()).toBe(false);
      expect(store.homePath$()).toBeNull();
      expect(localStorage.length).toBe(0);
    },
  );

  it('signs out when the network fails', async () => {
    await restoreWithToken();
    store.signOut();
    await settle();
    backend.expectOne('/api/v1/auth/logout').error(new ProgressEvent('error'));
    await settle();

    expect(store.isSignedIn$()).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('keeps whenReady pending after a failed restore until a retry succeeds', async () => {
    let ready = false;
    const waiting = store.whenReady().then(() => (ready = true));
    storeToken();
    store.restore();
    await settle();
    backend
      .expectOne(ME_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(ready).toBe(false);

    store.restore();
    await settle();
    backend.expectOne(ME_URL).flush(meV1Body);
    await settle();
    await waiting;
    expect(ready).toBe(true);
  });

  it('resolves whenReady once restore has answered', async () => {
    let settled = false;
    const waiting = store.whenReady().then(() => (settled = true));
    storeToken();
    store.restore();
    await settle();
    expect(settled).toBe(false);
    backend.expectOne(ME_URL).flush(meV1Body);
    await settle();
    await waiting;
    expect(settled).toBe(true);
  });

  it('forgets the user and the token when the session expires', async () => {
    await restoreWithToken();
    store.expire();
    expect(store.isSignedIn$()).toBe(false);
    expect(store.status$()).toBe('ready');
    expect(localStorage.length).toBe(0);
  });
});
