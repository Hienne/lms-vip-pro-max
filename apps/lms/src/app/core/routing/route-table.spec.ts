import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Permission, Role } from '@lms/contracts';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { SessionStore } from '../session/session.store';
import type { ForbiddenState } from './forbidden-state';
import { ROUTE_DEFS } from './route-table';

/** Just what the guards read from the session. */
class FakeSession {
  readonly role = signal<Role | null>(null);
  readonly perms = signal<readonly Permission[]>([]);
  readonly role$ = this.role.asReadonly();
  readonly perms$ = this.perms.asReadonly();
  readonly isSignedIn$ = () => this.role() !== null;
  // What the login page reads; these tests only render it.
  readonly user$ = () => null;
  readonly isSigningIn$ = () => false;
  readonly signInError$ = () => undefined;
  whenReady = () => Promise.resolve();
}

describe('route table', () => {
  let session: FakeSession;
  let router: Router;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useValue: session },
      ],
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  const signInAs = (role: Role) => session.role.set(role);

  it('lists every route of the mockup router except the ones with their own entry', () => {
    expect(ROUTE_DEFS.map((def) => def.path)).toEqual([
      'login',
      'learn',
      'catalog',
      'course/:id',
      'lesson/:courseId/:lessonId',
      'quiz/:id',
      'quiz/:id/take',
      'quiz/:id/result/:attemptId',
      'quiz/:id/attempts',
      'progress',
      'leaderboard',
      'certificates',
      'certificate/:id',
      'saved',
      'flashcards',
      'assistant',
      'notifications',
      'profile',
      'instructor',
      'instructor/inbox',
      'admin',
      'admin/catalog',
      'admin/courses',
      'admin/courses/new',
      'admin/courses/:id/edit',
      'admin/questions',
      'admin/quizzes',
      'admin/quizzes/:id',
      'admin/import',
      'admin/users',
      'admin/users/:id',
      'admin/org',
      'admin/assignments',
      'admin/system',
      'reports',
      'reports/:dim',
      '403',
    ]);
  });

  it('sends an anonymous visitor to the login page, remembering the page asked for', async () => {
    await harness.navigateByUrl('/admin/users/u1?tab=activity');
    expect(router.url).toBe(
      '/login?next=%2Fadmin%2Fusers%2Fu1%3Ftab%3Dactivity',
    );
  });

  it('lets an anonymous visitor reach the login page and the design system', async () => {
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/login');
    await harness.navigateByUrl('/design-system');
    expect(router.url).toBe('/design-system');
  });

  it('lets a role in and renders the placeholder naming the mockup page', async () => {
    signInAs('admin');
    await harness.navigateByUrl('/admin/users');
    expect(router.url).toBe('/admin/users');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      '“users”',
    );
  });

  it.each([
    ['learner', '/admin/users', ['admin']],
    ['viewer', '/learn', ['learner']],
    ['learner', '/instructor', ['instructor', 'admin']],
    ['viewer', '/admin/courses', ['admin', 'instructor']],
  ] as const)(
    'sends %s from %s to /403 with the roles that may enter',
    async (role, url, roles) => {
      signInAs(role);
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/403');
      const state = router.lastSuccessfulNavigation()?.extras.state as
        | ForbiddenState
        | undefined;
      expect(state?.path).toBe(url);
      expect([...(state?.roles ?? [])]).toEqual([...roles]);
    },
  );

  it('keeps next through an anonymous visit to a nested page', async () => {
    await harness.navigateByUrl('/quiz/q1/result/a1');
    expect(router.url).toBe('/login?next=%2Fquiz%2Fq1%2Fresult%2Fa1');
  });

  it('serves 403 to any signed-in role, and to nobody anonymous', async () => {
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/login?next=%2F403');
    signInAs('viewer');
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/403');
  });

  it('carries roles and layout in route data', () => {
    const learn = ROUTE_DEFS.find((def) => def.path === 'learn');
    const lesson = ROUTE_DEFS.find(
      (def) => def.path === 'lesson/:courseId/:lessonId',
    );
    const login = ROUTE_DEFS.find((def) => def.path === 'login');
    expect(learn?.roles).toEqual(['learner']);
    expect(lesson?.layout).toBe('focus');
    expect(login?.layout).toBe('bare');
    expect(login?.public).toBe(true);
  });
});
