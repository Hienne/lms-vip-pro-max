import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { envelopeError, envelopeOk, profileFixtures } from '@lms/mocks';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SessionStore } from './session.store';

const anonymous = envelopeError(
  'CORE-0401',
  'Cần đăng nhập',
  'Token không hợp lệ.',
);

describe('SessionStore', () => {
  let store: SessionStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideEnvelopeHttpClient(), SessionStore],
    });
    store = TestBed.inject(SessionStore);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  async function restoreAs(profile: keyof typeof profileFixtures) {
    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures[profile]));
    await settle();
  }

  it('is loading until restore answers, then exposes the profile', async () => {
    expect(store.status$()).toBe('loading');
    store.restore();
    await settle();
    expect(store.status$()).toBe('loading');
    expect(store.isSignedIn$()).toBe(false);

    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();

    expect(store.status$()).toBe('ready');
    expect(store.isSignedIn$()).toBe(true);
    expect(store.user$()?.roleId).toBe('admin');
    expect(store.user$()?.name).toBe(profileFixtures['admin'].name);
    expect(store.menus$()).toEqual(profileFixtures['admin'].menus);
    expect(store.homePath$()).toBe('/admin');
  });

  it('reads the role and its menus from the profile only', async () => {
    await restoreAs('viewer');
    expect(store.user$()?.roleId).toBe('viewer');
    expect(store.menus$()).toEqual(['reports']);
  });

  it.each([
    ['an HTTP 401', 'http'],
    ['a CORE-0401 envelope', 'envelope'],
  ] as const)(
    'treats %s on restore as anonymous, not as an error',
    async (_name, how) => {
      store.restore();
      await settle();
      const request = backend.expectOne('/api/auth/profile');
      if (how === 'http') {
        request.flush({}, { status: 401, statusText: 'Unauthorized' });
      } else {
        request.flush(anonymous);
      }
      await settle();

      expect(store.status$()).toBe('ready');
      expect(store.isSignedIn$()).toBe(false);
      expect(store.homePath$()).toBeNull();
      expect(store.menus$()).toEqual([]);
      expect(store.loadError$()).toBeUndefined();
    },
  );

  it('reports any other restore failure and retries on the next restore', async () => {
    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(store.status$()).toBe('error');
    expect(store.loadError$()?.kind).toBe('unknown');

    store.restore();
    await settle();
    expect(store.status$()).toBe('loading');
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['learner']));
    await settle();
    expect(store.status$()).toBe('ready');
    expect(store.user$()?.roleId).toBe('learner');
  });

  it('signs in with email and password, then loads the profile', async () => {
    await restoreAs('learner');
    store.signIn({ email: 'quanly@demo.cb', password: 'abc123' });
    await settle();

    expect(store.isSigningIn$()).toBe(true);
    const login = backend.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({
      email: 'quanly@demo.cb',
      password: 'abc123',
    });
    login.flush(envelopeOk({ id: 'a1', roleId: 'admin' }));
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();

    expect(store.isSigningIn$()).toBe(false);
    expect(store.user$()?.roleId).toBe('admin');
    expect(store.signInError$()).toBeUndefined();
  });

  it('exposes a refused sign-in with the backend title and message, and stays anonymous', async () => {
    store.restore();
    await settle();
    backend.expectOne('/api/auth/profile').flush(anonymous);
    await settle();

    store.signIn({ email: 'x@demo.cb', password: 'bad' });
    await settle();
    backend
      .expectOne('/api/auth/login')
      .flush(
        envelopeError(
          'CORE-0402',
          'Đăng nhập thất bại',
          'Email hoặc mật khẩu không đúng.',
        ),
      );
    await settle();

    expect(store.signInError$()).toMatchObject({
      kind: 'server',
      title: 'Đăng nhập thất bại',
      message: 'Email hoặc mật khẩu không đúng.',
    });
    expect(store.isSignedIn$()).toBe(false);
  });

  it('signs in as a demo account, then loads the profile', async () => {
    await restoreAs('learner');
    store.signInDemo('a1');
    await settle();
    const login = backend.expectOne('/api/auth/demo-accounts/a1/login');
    expect(login.request.method).toBe('POST');
    login.flush(envelopeOk({ id: 'a1', roleId: 'admin' }));
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();
    expect(store.user$()?.roleId).toBe('admin');
  });

  it('reports a locked demo account', async () => {
    await restoreAs('learner');
    store.signInDemo('l7');
    await settle();
    backend
      .expectOne('/api/auth/demo-accounts/l7/login')
      .flush(
        envelopeError(
          'CORE-0423',
          'Tài khoản bị khóa',
          'Tài khoản đã bị khóa.',
        ),
      );
    await settle();
    expect(store.signInError$()).toMatchObject({
      kind: 'server',
      message: 'Tài khoản đã bị khóa.',
    });
  });

  it('signs out and becomes anonymous, even when the server call fails', async () => {
    await restoreAs('admin');
    store.signOut();
    await settle();
    expect(store.isSigningOut$()).toBe(true);
    backend
      .expectOne('/api/auth/logout')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(store.isSigningOut$()).toBe(false);
    expect(store.isSignedIn$()).toBe(false);
    expect(store.homePath$()).toBeNull();
  });

  it('keeps whenReady pending after a failed restore until a retry succeeds', async () => {
    let ready = false;
    const waiting = store.whenReady().then(() => (ready = true));
    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(ready).toBe(false);

    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();
    await waiting;
    expect(ready).toBe(true);
  });

  it('resolves whenReady once restore has answered', async () => {
    let settled = false;
    const waiting = store.whenReady().then(() => (settled = true));
    store.restore();
    await settle();
    expect(settled).toBe(false);
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['admin']));
    await settle();
    await waiting;
    expect(settled).toBe(true);
  });

  it('forgets the user when the session expires', async () => {
    await restoreAs('learner');
    store.expire();
    expect(store.isSignedIn$()).toBe(false);
    expect(store.status$()).toBe('ready');
  });
});
