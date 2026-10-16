import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelopeError, envelopeOk, profileFixtures } from '@lms/mocks';
import { App } from './app';
import { createAppRoutes } from './app.routes';
import { provideAppConfig, parseAppConfig } from './core/config/app-config';
import { testAppConfig } from './core/config/app-config.testing';
import { provideEnvelopeHttpClient } from './core/http/http.testing';
import { provideSession } from './core/session/session.provider';

describe('App boot', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideEnvelopeHttpClient(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        provideSession(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    // The shell loads its badge counts once a user is signed in; no test here is about them.
    backend
      .match('/api/me/nav-counts')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk({ notifications: 0, inbox: 0 })));
    // The login page, where an anonymous visitor lands, offers the demo accounts.
    backend
      .match('/api/auth/demo-accounts')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk([])));
    backend.verify();
  });

  const text = (el: Element) => el.textContent ?? '';
  /** The shell is deferred, so the outlet appears once its chunk has loaded. */
  const appRendered = (el: HTMLElement) =>
    vi.waitFor(() => {
      TestBed.tick();
      expect(el.querySelector('router-outlet')).not.toBeNull();
    });

  async function tick(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }

  it('shows a loading state, then the app once the profile answers', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await tick();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('router-outlet')).toBeNull();

    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['learner']));
    await tick();
    await appRendered(el);
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('renders the error state with retry when restore fails', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await tick();
    backend
      .expectOne('/api/auth/profile')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(text(el)).toContain('Không tải được phiên đăng nhập');
    });

    el.querySelector<HTMLButtonElement>('button')?.click();
    await tick();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures['learner']));
    await tick();
    await appRendered(el);
  });

  it.each([
    ['learner', '/learn'],
    ['instructor', '/instructor'],
    ['admin', '/admin'],
    ['viewer', '/reports'],
  ] as const)('sends / to the home of %s', async (role, home) => {
    const harness = await RouterTestingHarness.create();
    TestBed.createComponent(App);
    const navigating = harness.navigateByUrl('/');
    await tick();
    backend
      .expectOne('/api/auth/profile')
      .flush(envelopeOk(profileFixtures[role]));
    await tick();
    await navigating;
    expect(TestBed.inject(Router).url).toBe(home);
  });

  it('sends / to the login page for an anonymous visitor', async () => {
    const harness = await RouterTestingHarness.create();
    TestBed.createComponent(App);
    const navigating = harness.navigateByUrl('/');
    await tick();
    backend
      .expectOne('/api/auth/profile')
      .flush(
        envelopeError('CORE-0401', 'Cần đăng nhập', 'Token không hợp lệ.'),
      );
    await tick();
    await navigating;
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
