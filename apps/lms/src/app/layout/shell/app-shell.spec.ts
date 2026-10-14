import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Permission, Profile } from '@lms/contracts';
import { profileFixtures } from '@lms/mocks';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { SessionStore } from '../../core/session/session.store';
import { AppShell } from './app-shell';

class FakeSession {
  readonly user = signal<Profile | null>(null);
  readonly user$ = this.user.asReadonly();
  readonly role$ = () => this.user()?.role ?? null;
  readonly perms$ = (): readonly Permission[] => this.user()?.perms ?? [];
  readonly isSignedIn$ = () => this.user() !== null;
  whenReady = () => Promise.resolve();
}

describe('AppShell', () => {
  let session: FakeSession;
  let router: Router;

  beforeEach(() => {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useValue: session },
      ],
    });
    router = TestBed.inject(Router);
  });

  const signInAs = (key: keyof typeof profileFixtures) =>
    session.user.set(profileFixtures[key]);

  async function open(url: string) {
    const fixture = TestBed.createComponent(AppShell);
    await router.navigateByUrl(url);
    await fixture.whenStable();
    TestBed.tick();
    return fixture.nativeElement as HTMLElement;
  }

  const hrefs = (el: Element) =>
    Array.from(el.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));

  it.each([
    [
      'learner',
      '/learn',
      [
        '/learn',
        '/catalog',
        '/progress',
        '/leaderboard',
        '/assistant',
        '/flashcards',
        '/saved',
        '/certificates',
      ],
    ],
    [
      'viewer',
      '/reports',
      [
        '/reports',
        '/reports/learners',
        '/reports/courses',
        '/reports/units',
        '/reports/competency',
      ],
    ],
    [
      'instructor',
      '/instructor',
      [
        '/instructor',
        '/instructor/inbox',
        '/admin/catalog',
        '/admin/courses',
        '/admin/questions',
        '/admin/quizzes',
        '/admin/import',
        '/reports',
      ],
    ],
    [
      'admin',
      '/admin',
      [
        '/admin',
        '/admin/catalog',
        '/admin/courses',
        '/admin/questions',
        '/admin/quizzes',
        '/admin/import',
        '/admin/users',
        '/admin/org',
        '/admin/assignments',
        '/reports',
        '/instructor/inbox',
        '/admin/system',
      ],
    ],
  ] as const)('lists the sidebar of %s', async (role, url, expected) => {
    signInAs(role);
    const el = await open(url);
    expect(hrefs(el)).toEqual([...expected]);
  });

  it('names the role of the user', async () => {
    signInAs('admin');
    const role = (await open('/admin')).querySelector('.sidebar__role');
    expect(role?.textContent).toContain('Quản trị viên');
    expect(role?.textContent).not.toContain('đơn vị');
  });

  it('says "đơn vị" for an admin limited to one unit', async () => {
    signInAs('unit-admin');
    const el = await open('/admin');
    expect(el.querySelector('.sidebar__role')?.textContent).toContain(
      'Quản trị viên đơn vị',
    );
  });

  it('marks only the longest matching item as the current page', async () => {
    signInAs('admin');
    const el = await open('/admin/courses/new');
    const current = Array.from(
      el.querySelectorAll('nav a[aria-current="page"]'),
    );
    expect(current.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/courses',
    ]);
  });

  it('moves the current-page mark when the user navigates', async () => {
    signInAs('learner');
    const el = await open('/learn');
    expect(
      el.querySelector('nav a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/learn');
    await router.navigateByUrl('/catalog');
    TestBed.tick();
    expect(
      el.querySelector('nav a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/catalog');
  });

  it('links to the design system from the footer', async () => {
    signInAs('learner');
    const el = await open('/learn');
    expect(
      el.querySelector('.sidebar__design-link')?.getAttribute('href'),
    ).toBe('/design-system');
  });

  it('frames app routes with sidebar and header', async () => {
    signInAs('learner');
    const el = await open('/learn');
    expect(el.querySelector('app-sidebar')).not.toBeNull();
    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('main#main')).not.toBeNull();
  });

  it('drops the frame for focus routes', async () => {
    signInAs('learner');
    const el = await open('/lesson/c1/l1');
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-header')).toBeNull();
    expect(el.querySelector('main')).not.toBeNull();
  });

  it('drops the frame for bare routes and for visitors', async () => {
    const visitor = await open('/login');
    expect(visitor.querySelector('app-sidebar')).toBeNull();
    expect(visitor.querySelector('app-header')).toBeNull();
    signInAs('learner');
    const el = await open('/login');
    expect(el.querySelector('app-sidebar')).toBeNull();
  });

  describe('below the lg breakpoint', () => {
    const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

    afterEach(() =>
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((c) => (c.innerHTML = '')),
    );

    async function openDrawer(el: HTMLElement) {
      el.querySelector<HTMLButtonElement>('app-header button')?.click();
      TestBed.tick();
      await vi.waitFor(() => expect(dialog()).not.toBeNull());
    }

    it('opens the navigation in a drawer from the header menu button', async () => {
      signInAs('learner');
      const el = await open('/learn');
      const button = el.querySelector<HTMLButtonElement>('app-header button');
      expect(button?.getAttribute('aria-label')).toBe('Mở menu điều hướng');
      expect(button?.getAttribute('aria-expanded')).toBe('false');

      await openDrawer(el);
      expect(dialog()?.querySelectorAll('nav a')).toHaveLength(8);
      expect(button?.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes the drawer when the user navigates', async () => {
      signInAs('learner');
      const el = await open('/learn');
      await openDrawer(el);
      await router.navigateByUrl('/catalog');
      TestBed.tick();
      await vi.waitFor(() => expect(dialog()).toBeNull());
      expect(
        el.querySelector('app-header button')?.getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('closes on Escape and gives focus back to the menu button', async () => {
      signInAs('learner');
      const el = await open('/learn');
      const button = el.querySelector<HTMLButtonElement>('app-header button');
      button?.focus();
      await openDrawer(el);
      dialog()?.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          bubbles: true,
        }),
      );
      TestBed.tick();
      await vi.waitFor(() => expect(dialog()).toBeNull());
      expect(document.activeElement).toBe(button);
    });
  });
});
