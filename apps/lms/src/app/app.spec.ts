import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { envelopeOk } from '@lms/mocks';
import { App } from './app';
import { createAppRoutes } from './app.routes';
import { provideAppConfig, parseAppConfig } from './core/config/app-config';
import { testAppConfig } from './core/config/app-config.testing';
import { provideEnvelopeHttpClient } from './core/http/http.testing';
import { provideSession } from './core/session/session.provider';
import { flushMe, ME_URL, storeToken } from './core/session/session.testing';

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
    storeToken();
  });
  afterEach(() => {
    // The shell loads its badge counts (the learner's due reminders without the mock API) and the
    // owl's unfinished uploads once a user is signed in; no test here is about them.
    backend
      .match('/api/me/nav-counts')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk({ notifications: 0, inbox: 0 })));
    backend
      .match('/api/v1/me/learning/reminders')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk([])));
    // The learner home behind /learn reads the progress, the course lists and the competencies.
    backend
      .match(
        (r) =>
          r.url.startsWith('/api/v1/me/learning/') ||
          r.url === '/api/v1/me/competency' ||
          r.url === '/api/v1/training-catalog/programs',
      )
      .filter((r) => !r.cancelled)
      .forEach((r) => r.error(new ProgressEvent('error')));
    backend
      .match((r) => r.url === '/api/v1/knowledge/documents')
      .filter((r) => !r.cancelled)
      .forEach((r) =>
        r.flush(
          envelopeOk({
            items: [],
            page: 0,
            size: 100,
            totalElements: 0,
            totalPages: 0,
          }),
        ),
      );
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

    flushMe(backend);
    await tick();
    await appRendered(el);
    expect(el.querySelector('[role="status"]')).toBeNull();
  });

  it('renders the error state with retry when restore fails', async () => {
    const fixture = TestBed.createComponent(App);
    const el = fixture.nativeElement as HTMLElement;
    await tick();
    backend
      .expectOne(ME_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await tick();
    await vi.waitFor(() => {
      TestBed.tick();
      expect(text(el)).toContain('Không tải được phiên đăng nhập');
    });

    el.querySelector<HTMLButtonElement>('button')?.click();
    await tick();
    flushMe(backend);
    await tick();
    await appRendered(el);
  });

  // Every signed-in user lands on /learn until permissions are mapped (DEC-010).
  it('sends / to /learn for a signed-in user', async () => {
    const harness = await RouterTestingHarness.create();
    TestBed.createComponent(App);
    const navigating = harness.navigateByUrl('/');
    await tick();
    flushMe(backend);
    await tick();
    await navigating;
    expect(TestBed.inject(Router).url).toBe('/learn');
  });

  it('sends / to the login page for an anonymous visitor', async () => {
    localStorage.clear();
    const harness = await RouterTestingHarness.create();
    TestBed.createComponent(App);
    const navigating = harness.navigateByUrl('/');
    await tick();
    await navigating;
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
