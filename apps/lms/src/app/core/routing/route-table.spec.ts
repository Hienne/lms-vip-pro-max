import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { SessionStore } from '../session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../session/session.testing';
import type { ForbiddenState } from './forbidden-state';
import {
  FUNCTION_CODES,
  SCREEN_TABLE,
  menuGroup,
  SCREEN_ENTRIES,
  screenHref,
} from './screens';

/** The backend demo accounts by what they are, as the seed names them. */
const USERS = {
  superAdmin: '000001',
  admin: '000002',
  learner: '000004',
  instructor: '000005',
  reportViewer: '000006',
} as const;

describe('route table', () => {
  let session: FakeSessionStore;
  let router: Router;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    session = fakeSession();
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  const signInAs = (key: keyof typeof USERS) =>
    session.user.set(seedProfile(USERS[key]));

  it('lists the approved app routes including architecture reviews', () => {
    expect(new Set(SCREEN_ENTRIES.map(({ screen }) => screen.path))).toEqual(
      new Set([
        'login',
        'register',
        'forgot-password',
        'change-password',
        'profile',
        'learn',
        'catalog',
        'course/:id',
        'lesson/:courseId/:lessonId',
        'quiz',
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
        'admin/flashcards',
        'assistant',
        'chat-room',
        'notifications',
        'instructor',
        'instructor/inbox',
        'admin',
        'admin/catalog',
        'admin/courses',
        'admin/courses/new',
        'admin/courses/:id/edit',
        'admin/lessons',
        'admin/questions',
        'admin/quizzes',
        'admin/quizzes/:id',
        'admin/import',
        'admin/users',
        'admin/users/:id',
        'admin/org',
        'admin/roles',
        'admin/assignments',
        'admin/gamification',
        'admin/system',
        'reports',
        'reports/gamification',
        'reports/:dim',
        'knowledge',
        'issues',
        'community/questions',
        'community/questions/new',
        'community/contents/:id',
        'community/contents/:id/edit',
        'community/articles',
        'community/articles/new',
        'community/reviews',
        'community/reviews/new',
        'community/reviews/:id',
        'community/reviews/:id/edit',
        'community/me',
        'community/moderation',
        '403',
      ]),
    );
  });

  it('puts the community screens under the two community functions', () => {
    expect(menuGroup('COMMUNITY').screens[0].path).toBe('community/questions');
    expect(menuGroup('COMMUNITY').screens.map((s) => s.path)).toContain(
      'community/me',
    );
    expect(
      menuGroup('COMMUNITY_MODERATION').screens.map((s) => s.path),
    ).toEqual(['community/moderation']);
  });

  it('declares each path once', () => {
    const paths = SCREEN_ENTRIES.map(({ screen }) => screen.path);
    expect(paths.filter((path, i) => paths.indexOf(path) !== i)).toEqual([]);
  });

  it('starts every menu on a screen without a route parameter', () => {
    const entries = FUNCTION_CODES.map(
      (menu) => menuGroup(menu).screens[0].path,
    );
    expect(entries.filter((path) => path.includes(':'))).toEqual([]);
  });

  it('sends every search target to a screen of its own menu or an open screen', () => {
    // `reports/learners` is a concrete URL of the screen `reports/:dim`.
    const matches = (pattern: string, path: string) => {
      const want = pattern.split('/');
      const got = path.split('/');
      return (
        want.length === got.length &&
        want.every((part, i) => part.startsWith(':') || part === got[i])
      );
    };
    const targets = FUNCTION_CODES.flatMap((menu) => {
      const { search, screens } = menuGroup(menu);
      return search?.href
        ? [{ href: search.href, screens: [...screens, ...SCREEN_TABLE.open] }]
        : [];
    });
    expect(targets.length).toBeGreaterThan(0);
    for (const { href, screens } of targets) {
      expect(screens.some((screen) => matches(screen.path, href))).toBe(true);
    }
  });

  it('builds the URL of a static screen and refuses any other path at build time', () => {
    expect(screenHref('admin/users')).toBe('/admin/users');
    // @ts-expect-error a path with a route parameter is not a concrete URL
    screenHref('admin/users/:id');
    // @ts-expect-error there is no such screen
    screenHref('admin/nowhere');
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

  it('lets a user holding the function in and renders the coming-soon page titled with the screen', async () => {
    signInAs('admin');
    await harness.navigateByUrl('/admin/system');
    expect(router.url).toBe('/admin/system');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('h2')?.textContent).toContain(
      'Hệ thống & nhật ký',
    );
    expect(page.textContent).toContain('đang được hoàn thiện');
  });

  it.each([
    ['learner', '/admin/users', 'USER_MANAGEMENT'],
    ['reportViewer', '/learn', 'COURSE_LEARNING'],
    ['learner', '/admin/courses', 'COURSE_MANAGEMENT'],
    ['instructor', '/admin/roles', 'ROLE_MANAGEMENT'],
    ['admin', '/learn', 'COURSE_LEARNING'],
    ['learner', '/admin/catalog', 'TRAINING_CATALOG'],
    ['learner', '/instructor', 'COURSE_MANAGEMENT'],
    ['reportViewer', '/catalog', 'COURSE_LEARNING'],
    ['reportViewer', '/leaderboard', 'LEARNING_PROGRESS'],
    ['reportViewer', '/saved', 'COURSE_LEARNING'],
    ['admin', '/certificates', 'LEARNING_PROGRESS'],
  ] as const)(
    'sends %s from %s to /403 with the function that grants it',
    async (user, url, menu) => {
      signInAs(user);
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

  it('opens a screen by the function that covers it, and only that one', async () => {
    session.user.set({
      ...seedProfile(USERS.reportViewer),
      menus: ['PROFILE', 'COURSE_MANAGEMENT'],
    });
    await harness.navigateByUrl('/admin/courses/new');
    expect(router.url).toBe('/admin/courses/new');
    await harness.navigateByUrl('/admin/questions');
    expect(router.url).toBe('/403');
  });

  it('lets any signed-in user open the screens that belong to no function', async () => {
    signInAs('reportViewer');
    for (const url of ['/profile', '/notifications']) {
      await harness.navigateByUrl(url);
      expect(router.url).toBe(url);
    }
  });

  it('opens the certificates for a learner in a backend-only build, now that the backend serves them', async () => {
    signInAs('learner');
    for (const url of ['/certificates', '/certificate/1']) {
      await harness.navigateByUrl(url);
      expect(router.url).toBe(url);
    }
  });

  it('opens the saved page for a learner in a backend-only build, now that the backend serves it', async () => {
    signInAs('learner');
    await harness.navigateByUrl('/saved');
    expect(router.url).toBe('/saved');
  });

  it('sends a user with a temporary password to the password change from every other screen', async () => {
    session.user.set({
      ...seedProfile(USERS.learner),
      mustChangePassword: true,
    });
    await harness.navigateByUrl('/learn');
    expect(router.url).toBe('/change-password');
    await harness.navigateByUrl('/profile');
    expect(router.url).toBe('/change-password');
    await harness.navigateByUrl('/change-password');
    expect(router.url).toBe('/change-password');
  });

  it('serves 403 to any signed-in user, and to nobody anonymous', async () => {
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/login?next=%2F403');
    signInAs('reportViewer');
    await harness.navigateByUrl('/403');
    expect(router.url).toBe('/403');
  });

  it('carries the function code and layout in route data', () => {
    const dataOf = (path: string) =>
      createAppRoutes({ devTools: false }).find((r) => r.path === path)?.data;
    expect(dataOf('learn')).toMatchObject({
      menu: 'COURSE_LEARNING',
      layout: 'app',
    });
    expect(dataOf('lesson/:courseId/:lessonId')).toMatchObject({
      menu: 'COURSE_LEARNING',
      layout: 'focus',
    });
    expect(dataOf('assistant')).toMatchObject({
      menu: 'AI_ASSISTANT',
      layout: 'workspace',
    });
    expect(dataOf('login')).toMatchObject({ layout: 'bare' });
    expect(dataOf('login')).not.toHaveProperty('menu');
    expect(dataOf('change-password')).toMatchObject({
      layout: 'bare',
      passwordChange: true,
    });
  });

  it('tells the course editor whether it creates or edits', () => {
    const dataOf = (path: string) =>
      createAppRoutes({ devTools: false }).find((r) => r.path === path)?.data;
    expect(dataOf('admin/courses/new')).toMatchObject({ mode: 'create' });
    expect(dataOf('admin/courses/:id/edit')).not.toHaveProperty('mode');
  });

  it('keeps login public and visitor-only', () => {
    const login = createAppRoutes({ devTools: false }).find(
      (r) => r.path === 'login',
    );
    expect(login?.canMatch).toEqual([]);
    expect(login?.canActivate).toHaveLength(1);
  });
});
