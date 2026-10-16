import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { MenuKey, Profile } from '@lms/contracts';
import { profileFixtures } from '@lms/mocks';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { SessionStore } from '../session/session.store';
import type { ForbiddenState } from './forbidden-state';
import { SCREEN_ENTRIES } from './screens';

/** Just what the guards read from the session. */
class FakeSession {
  readonly user = signal<Profile | null>(null);
  readonly user$ = this.user.asReadonly();
  readonly menus$ = (): readonly MenuKey[] => this.user()?.menus ?? [];
  readonly homePath$ = () => this.user()?.homePath ?? null;
  readonly isSignedIn$ = () => this.user() !== null;
  // What the login page reads; these tests only render it.
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

  const signInAs = (key: keyof typeof profileFixtures) =>
    session.user.set(profileFixtures[key]);

  it('lists every route of the mockup router except the ones with their own entry', () => {
    expect(new Set(SCREEN_ENTRIES.map(({ screen }) => screen.path))).toEqual(
      new Set([
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
        'admin/roles',
        'admin/assignments',
        'admin/system',
        'reports',
        'reports/:dim',
        '403',
      ]),
    );
  });

  it('declares each path once', () => {
    const paths = SCREEN_ENTRIES.map(({ screen }) => screen.path);
    expect(paths.filter((path, i) => paths.indexOf(path) !== i)).toEqual([]);
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

  it('lets a role holding the menu in and renders the placeholder naming the mockup page', async () => {
    signInAs('admin');
    await harness.navigateByUrl('/admin/assignments');
    expect(router.url).toBe('/admin/assignments');
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
      '“assignments”',
    );
  });

  it.each([
    ['learner', '/admin/users', 'admin.users'],
    ['viewer', '/learn', 'learn.home'],
    ['learner', '/instructor', 'teach.home'],
    ['viewer', '/admin/courses', 'content.courses'],
    ['instructor', '/admin/roles', 'admin.roles'],
    ['admin', '/instructor', 'teach.home'],
  ] as const)(
    'sends %s from %s to /403 with the menu that grants it',
    async (role, url, menu) => {
      signInAs(role);
      await harness.navigateByUrl(url);
      expect(router.url).toBe('/403');
      const state = router.lastSuccessfulNavigation()?.extras.state as
        | ForbiddenState
        | undefined;
      expect(state?.path).toBe(url);
      expect(state?.menu).toBe(menu);
    },
  );

  it('keeps next through an anonymous visit to a nested page', async () => {
    await harness.navigateByUrl('/quiz/q1/result/a1');
    expect(router.url).toBe('/login?next=%2Fquiz%2Fq1%2Fresult%2Fa1');
  });

  it('shows a custom role only the screens of its menus', async () => {
    session.user.set({
      ...profileFixtures['viewer'],
      roleId: 'content-lead',
      menus: ['content.courses'],
      homePath: '/admin/courses',
    });
    await harness.navigateByUrl('/admin/courses/new');
    expect(router.url).toBe('/admin/courses/new');
    await harness.navigateByUrl('/admin/questions');
    expect(router.url).toBe('/403');
  });

  it('lets any signed-in user open the screens that belong to no menu', async () => {
    signInAs('viewer');
    for (const url of ['/profile', '/notifications', '/quiz/q1/result/a1']) {
      await harness.navigateByUrl(url);
      expect(router.url).toBe(url);
    }
  });

  it('serves 403 to any signed-in role, and to nobody anonymous', async () => {
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/login?next=%2F403');
    signInAs('viewer');
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/403');
  });

  it('carries the menu and layout in route data', () => {
    const dataOf = (path: string) =>
      createAppRoutes({ devTools: false }).find((r) => r.path === path)?.data;
    expect(dataOf('learn')).toMatchObject({
      menu: 'learn.home',
      layout: 'app',
    });
    expect(dataOf('lesson/:courseId/:lessonId')).toMatchObject({
      menu: 'learn.catalog',
      layout: 'focus',
    });
    expect(dataOf('login')).toMatchObject({ layout: 'bare' });
    expect(dataOf('login')).not.toHaveProperty('menu');
  });

  it('keeps login public and visitor-only', () => {
    const login = createAppRoutes({ devTools: false }).find(
      (r) => r.path === 'login',
    );
    expect(login?.canMatch).toEqual([]);
    expect(login?.canActivate).toHaveLength(1);
  });
});
