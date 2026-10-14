import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  loginDemoLocked,
  loginInvalid,
  loginLocked,
  loginUnauthorized,
  profileFixtures,
  profileUnauthorized,
} from '@lms/mocks';
import { SessionStore } from './session.store';

describe('SessionStore', () => {
  let store: SessionStore;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SessionStore,
      ],
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
    backend.expectOne('/api/auth/profile').flush(profileFixtures[profile]);
    await settle();
  }

  it('is loading until restore answers, then exposes the profile', async () => {
    expect(store.status$()).toBe('loading');
    store.restore();
    await settle();
    expect(store.status$()).toBe('loading');
    expect(store.isSignedIn$()).toBe(false);

    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();

    expect(store.status$()).toBe('ready');
    expect(store.isSignedIn$()).toBe(true);
    expect(store.role$()).toBe('admin');
    expect(store.user$()?.name).toBe(profileFixtures['admin'].name);
    expect(store.perms$()).toEqual(profileFixtures['admin'].perms);
  });

  it('reads role and permissions from the profile only', async () => {
    await restoreAs('viewer');
    expect(store.role$()).toBe('viewer');
    expect(store.perms$()).toEqual(profileFixtures['viewer'].perms);
  });

  it('treats a 401 on restore as anonymous, not as an error', async () => {
    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(profileUnauthorized, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(store.status$()).toBe('ready');
    expect(store.isSignedIn$()).toBe(false);
    expect(store.role$()).toBeNull();
    expect(store.perms$()).toEqual([]);
    expect(store.loadError$()).toBeUndefined();
  });

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
    backend.expectOne('/api/auth/profile').flush(profileFixtures['learner']);
    await settle();
    expect(store.status$()).toBe('ready');
    expect(store.role$()).toBe('learner');
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
    login.flush({ id: 'a1', role: 'admin' });
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();

    expect(store.isSigningIn$()).toBe(false);
    expect(store.role$()).toBe('admin');
    expect(store.signInError$()).toBeUndefined();
  });

  it('exposes the sign-in failure and stays as before', async () => {
    store.restore();
    await settle();
    backend
      .expectOne('/api/auth/profile')
      .flush(profileUnauthorized, { status: 401, statusText: 'Unauthorized' });
    await settle();

    store.signIn({ email: 'x@demo.cb', password: 'bad' });
    await settle();
    backend
      .expectOne('/api/auth/login')
      .flush(loginUnauthorized, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(store.signInError$()?.kind).toBe('unauthorized');
    expect(store.signInError$()?.message).toBe(loginUnauthorized.message);
    expect(store.isSignedIn$()).toBe(false);
  });

  it.each([
    [422, loginInvalid, 'invalid'],
    [423, loginLocked, 'locked'],
  ] as const)('maps a %s sign-in failure to %s', async (status, body, kind) => {
    await restoreAs('learner');
    store.signIn({ email: 'a', password: 'b' });
    await settle();
    backend
      .expectOne('/api/auth/login')
      .flush(body, { status, statusText: 'Error' });
    await settle();
    expect(store.signInError$()?.kind).toBe(kind);
  });

  it('signs in as a demo account, then loads the profile', async () => {
    await restoreAs('learner');
    store.signInDemo('a1');
    await settle();
    const login = backend.expectOne('/api/auth/demo-accounts/a1/login');
    expect(login.request.method).toBe('POST');
    login.flush({ id: 'a1', role: 'admin' });
    await settle();
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
    await settle();
    expect(store.role$()).toBe('admin');
  });

  it('reports a locked demo account', async () => {
    await restoreAs('learner');
    store.signInDemo('l7');
    await settle();
    backend
      .expectOne('/api/auth/demo-accounts/l7/login')
      .flush(loginDemoLocked, { status: 423, statusText: 'Locked' });
    await settle();
    expect(store.signInError$()?.kind).toBe('locked');
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
    expect(store.role$()).toBeNull();
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
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
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
    backend.expectOne('/api/auth/profile').flush(profileFixtures['admin']);
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
