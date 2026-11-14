import { Component, type Type, type WritableSignal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { envelopeOk, seedMe } from '@lms/mocks';
import { createAppRoutes } from '../../app.routes';
import { parseAppConfig, provideAppConfig } from '../../core/config/app-config';
import { testAppConfig } from '../../core/config/app-config.testing';
import { SessionStore } from '../../core/session/session.store';
import { toProfile } from '../../core/session/to-profile';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../core/session/session.testing';
import { AgentChatStore } from '../../core/assistant/agent-chat.store';
import { BackgroundUploads } from '../../core/uploads/background-uploads';
import { AppShell } from './app-shell';
import { LeavePrompt } from '../../core/routing/unsaved-changes.guard';
import { LOCAL_STORAGE } from '../../core/storage/local-storage';
import { SIDEBAR_COLLAPSED_KEY, ShellStore } from './data-access/shell.store';
import { provideEnvelopeHttpClient } from '../../core/http/http.testing';

/** The backend demo accounts by what they are, as the seed names them. */
const USERS = {
  learner: '000004',
  viewer: '000006',
  instructor: '000005',
  admin: '000002',
  'unit-admin': '000003',
} as const;

@Component({ template: '' })
class DevToolbarStub {}

describe('AppShell', () => {
  let session: FakeSessionStore;
  let router: Router;
  let storage: Map<string, string>;

  beforeEach(() => {
    // The learner home behind /learn is a page of tabs, and @angular/aria warns in dev mode with
    // `console.warn('%o', element)` for each panel. Node's util.inspect throws on a jsdom element
    // there, and Angular's error handler logs that throw again in a loop until the test times out.
    // No test here is about the tab panels, so the warning is dropped.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage = new Map();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig({ mockApi: true }))),
        provideRouter(createAppRoutes({ devTools: true })),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        {
          provide: LOCAL_STORAGE,
          useValue: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
          },
        },
      ],
    });
    session = fakeSession();
    router = TestBed.inject(Router);
  });

  afterEach(() =>
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((c) => (c.innerHTML = '')),
  );

  const signInAs = (key: keyof typeof USERS) =>
    session.user.set(seedProfile(USERS[key]));

  type Counts = { notifications: number; inbox: number };

  /** Answers the requests the shell makes once a user is signed in: nav counts and the owl's tracker. */
  function flushCounts(counts: Counts = { notifications: 0, inbox: 0 }) {
    TestBed.tick();
    const backend = TestBed.inject(HttpTestingController);
    backend
      .match('/api/me/nav-counts')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk(counts)));
    // The learner home behind /learn reads the progress, the course lists and the competencies, the reports
    // page its overview, and /flashcards the learner's own decks; no test here is about them.
    backend
      .match(
        (r) =>
          r.url.startsWith('/api/v1/me/learning/') ||
          r.url === '/api/v1/me/competency' ||
          r.url === '/api/v1/me/flashcard-decks' ||
          r.url === '/api/v1/training-catalog/programs' ||
          r.url === '/api/v1/orgs' ||
          r.url === '/api/v1/competencies' ||
          r.url.startsWith('/api/v1/reports/assessment/'),
      )
      .filter((r) => !r.cancelled)
      .forEach((r) => r.error(new ProgressEvent('error')));
    // An instructor's bell counts the questions waiting for an answer; there are none.
    backend
      .match((r) => r.url === '/api/v1/instructor/feedback/summary')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk({ newCount: 0 })));
    // The assistant screen lists the user's saved conversations beside the chat; there are none.
    backend
      .match((r) => r.url === '/api/v1/assistant/conversations')
      .filter((r) => !r.cancelled)
      .forEach((r) =>
        r.flush(
          envelopeOk({
            items: [],
            page: 0,
            size: 50,
            totalElements: 0,
            totalPages: 0,
          }),
        ),
      );
    // The assistant screen also lists the user's duplicate documents; there are none.
    backend
      .match((r) => r.url === '/api/v1/knowledge/documents/duplicates')
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk([])));
    // The owl's tracker asks for the user's unfinished uploads; there are none.
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
    // An instructor's or admin's tracker asks for their course generations; there are none.
    backend
      .match(
        (r) =>
          r.url === '/api/v1/assistant/course-jobs' ||
          r.url === '/api/v1/assistant/course-jobs/active',
      )
      .filter((r) => !r.cancelled)
      .forEach((r) => r.flush(envelopeOk([])));
  }

  async function open(url: string, counts?: Counts) {
    const fixture = TestBed.createComponent(AppShell);
    await router.navigateByUrl(url);
    flushCounts(counts);
    await fixture.whenStable();
    TestBed.tick();
    return fixture.nativeElement as HTMLElement;
  }

  const hrefs = (el: Element) =>
    Array.from(el.querySelectorAll('app-sidebar nav a')).map((a) =>
      a.getAttribute('href'),
    );

  // The profile is not in the sidebar: it opens from the account menu in the header.
  it.each([
    [
      'instructor',
      '/learn',
      [
        '/learn',
        '/progress',
        '/quiz',
        '/admin/courses',
        '/admin/catalog',
        '/admin/lessons',
        '/admin/questions',
        '/admin/quizzes',
        '/reports',
        '/assistant',
        '/community/questions',
        '/community/articles',
        '/community/reviews',
        '/community/me',
        '/chat-room',
      ],
    ],
    [
      'admin',
      '/admin/system',
      [
        '/admin/courses',
        '/admin/catalog',
        '/admin/lessons',
        '/admin/questions',
        '/admin/quizzes',
        '/admin/users',
        '/admin/org',
        '/admin/roles',
        '/admin/assignments',
        '/community/moderation',
        '/reports',
        '/admin/gamification',
        '/assistant',
        '/community/questions',
        '/community/articles',
        '/community/reviews',
        '/community/me',
        '/chat-room',
      ],
    ],
  ] as const)(
    'lists the sidebar of %s from the functions /me lists, in the backend order',
    async (role, url, expected) => {
      signInAs(role);
      const el = await open(url);
      expect(hrefs(el)).toEqual([...expected]);
      const roomLink = el.querySelector(
        'app-sidebar ul[aria-label="Cộng đồng"] a[href="/chat-room"]',
      );
      expect(roomLink?.textContent?.trim()).toBe('Giờ ra chơi');
      expect(
        el.querySelectorAll('app-sidebar a[href="/chat-room"]'),
      ).toHaveLength(1);
    },
  );

  function openLearnerGroup(el: HTMLElement, id: string): HTMLElement | null {
    el.querySelector<HTMLButtonElement>(
      `[data-header-panel="${id}"] button`,
    )?.click();
    TestBed.tick();
    return el.querySelector(`#learner-nav-${id}`);
  }

  it('groups learner links in the header, with the profile kept out of navigation', async () => {
    signInAs('learner');
    const el = await open('/learn');
    const nav = el.querySelector('nav[aria-label="Điều hướng học viên"]');
    expect(
      Array.from(nav?.querySelectorAll('button') ?? []).map((button) =>
        button.textContent?.trim(),
      ),
    ).toEqual(['Học tập', 'Công cụ học', 'Cộng đồng']);
    const hrefsOf = (id: string) =>
      Array.from(openLearnerGroup(el, id)?.querySelectorAll('a') ?? []).map(
        (link) => link.getAttribute('href'),
      );
    expect(hrefsOf('learn')).toEqual([
      '/learn',
      '/catalog',
      '/progress',
      '/quiz',
    ]);
    expect(hrefsOf('tools')).toEqual(
      expect.arrayContaining([
        '/assistant',
        '/saved',
        '/flashcards',
        '/certificates',
      ]),
    );
    expect(hrefsOf('community')).toEqual([
      '/community/questions',
      '/community/articles',
      '/community/reviews',
      '/community/me',
      '/chat-room',
    ]);
    expect(
      el
        .querySelector('#learner-nav-community a[href="/chat-room"]')
        ?.textContent?.trim(),
    ).toBe('Giờ ra chơi');
    expect(nav?.querySelector('a[href="/profile"]')).toBeNull();
  });

  it('shows no entry for a function the app has no screen for', async () => {
    const me = seedMe(USERS.learner);
    session.user.set(
      toProfile({
        ...me,
        functions: [...me.functions, 'FUTURE_SCREEN'],
        functionDetails: [
          ...me.functionDetails,
          { id: 99, code: 'FUTURE_SCREEN', name: 'Mới', sortNo: 999 },
        ],
      }),
    );
    const el = await open('/learn');
    expect(el.querySelector('nav')?.textContent).not.toContain('Mới');
  });

  it('names the roles of the user', async () => {
    signInAs('admin');
    const role = (await open('/admin/system')).querySelector('.sidebar__role');
    expect(role?.textContent).toContain('Quản trị viên');
  });

  it('lists every distinct role of a user with two grants', async () => {
    signInAs('instructor');
    const el = await open('/learn');
    expect(el.querySelector('.sidebar__role')?.textContent).toContain(
      'Học viên, Giảng viên',
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
    openLearnerGroup(el, 'learn');
    expect(
      el.querySelector('nav a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/learn');
    await router.navigateByUrl('/progress');
    TestBed.tick();
    expect(el.querySelector('#learner-nav-learn')).toBeNull();
    openLearnerGroup(el, 'learn');
    expect(
      el.querySelector('nav a[aria-current="page"]')?.getAttribute('href'),
    ).toBe('/progress');
  });

  it('links to the design system from the footer', async () => {
    signInAs('instructor');
    const el = await open('/learn');
    expect(
      el.querySelector('.sidebar__design-link')?.getAttribute('href'),
    ).toBe('/design-system');
  });

  it('frames learner routes with the header and no sidebar column', async () => {
    signInAs('learner');
    const el = await open('/learn');
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('.app-shell--framed')).toBeNull();
    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('main#main')).not.toBeNull();
    expect(el.querySelector('app-owl button')).not.toBeNull();
    expect(el.querySelector('.app-shell')?.classList).not.toContain(
      'app-shell--fill',
    );
  });

  it('shows the background uploads beside the owl on app pages only', async () => {
    signInAs('learner');
    const registry = TestBed.inject(BackgroundUploads);
    registry.publish({
      items: [
        {
          id: 'a',
          name: 'bai-giang.mp4',
          place: 'Chương 1 · Bài 2',
          percent: 30,
          state: 'uploading',
          cancellable: true,
        },
      ],
      drawerOpen: false,
      cancel: vi.fn(),
      open: vi.fn(),
    });
    const el = await open('/learn');
    TestBed.tick();
    expect(el.querySelector('app-upload-panel')?.textContent).toContain(
      'Đang tải lên (1)',
    );

    const focus = await open('/lesson/c1/l1');
    expect(focus.querySelector('app-upload-panel')).toBeNull();
  });

  it('lets a workspace page fill the viewport and quiets the owl there', async () => {
    signInAs('learner');
    const el = await open('/assistant');
    expect(el.querySelector('app-header')).not.toBeNull();
    expect(el.querySelector('.app-shell')?.classList).toContain(
      'app-shell--fill',
    );
    expect(el.querySelector('app-owl button')).toBeNull();
  });

  describe('the quick assistant panel', () => {
    const panel = (el: HTMLElement) =>
      el.querySelector('app-chat-widget [role="dialog"]');

    it('shows while it is open, and not before', async () => {
      signInAs('learner');
      const closed = await open('/learn');
      expect(panel(closed)).toBeNull();
      TestBed.inject(AgentChatStore).open();
      TestBed.tick();
      await TestBed.inject(Router).navigateByUrl('/profile');
      TestBed.tick();
      expect(panel(closed)).not.toBeNull();
    });

    it('makes room for a docked panel, but not on the assistant screen', async () => {
      signInAs('learner');
      const chat = TestBed.inject(AgentChatStore);
      chat.open();
      chat.toggleDocked();
      const el = await open('/learn');
      expect(el.querySelector('.app-shell')?.classList).toContain(
        'app-shell--docked',
      );
      await TestBed.inject(Router).navigateByUrl('/assistant');
      TestBed.tick();
      expect(el.querySelector('.app-shell')?.classList).not.toContain(
        'app-shell--docked',
      );
    });

    it('is hidden on the assistant screen, which is the full version', async () => {
      signInAs('learner');
      TestBed.inject(AgentChatStore).open();
      const el = await open('/assistant');
      expect(el.querySelector('app-chat-widget')).toBeNull();
    });

    it('is not offered to a user without the assistant function', async () => {
      const profile = seedProfile(USERS.learner);
      session.user.set({
        ...profile,
        menus: profile.menus.filter((code) => code !== 'AI_ASSISTANT'),
      });
      TestBed.inject(AgentChatStore).open();
      const el = await open('/learn');
      expect(panel(el)).toBeNull();
    });

    it('opens on a focus route (a lesson) without the owl', async () => {
      signInAs('learner');
      TestBed.inject(AgentChatStore).open();
      const focus = await open('/lesson/c1/l1');
      expect(panel(focus)).not.toBeNull();
      expect(focus.querySelector('app-owl')).toBeNull();
    });

    it('stays closed on a focus route until a lesson button opens it', async () => {
      signInAs('learner');
      const focus = await open('/lesson/c1/l1');
      expect(panel(focus)).toBeNull();
      TestBed.inject(AgentChatStore).open();
      TestBed.tick();
      expect(panel(focus)).not.toBeNull();
    });

    it('opens and closes from the owl, and Escape hands focus back to it', async () => {
      signInAs('learner');
      const el = await open('/learn');
      const owl = el.querySelector<HTMLButtonElement>('app-owl button')!;
      owl.click();
      TestBed.tick();
      expect(panel(el)).not.toBeNull();
      expect(owl.getAttribute('aria-expanded')).toBe('true');
      expect(owl.getAttribute('aria-controls')).toBe(panel(el)?.id);
      el.querySelector('textarea')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      TestBed.tick();
      expect(panel(el)).toBeNull();
      expect(owl.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(owl);
    });

    it('moves with the owl off the dev toolbar', async () => {
      signInAs('learner');
      TestBed.inject(AgentChatStore).open();
      const fixture = TestBed.createComponent(AppShell);
      await router.navigateByUrl('/learn');
      flushCounts();
      await fixture.whenStable();
      TestBed.tick();
      const el = fixture.nativeElement as HTMLElement;
      const beside = () => [
        el.querySelector('app-owl')?.classList.contains('owl--beside-toolbar'),
        el
          .querySelector('app-chat-widget')
          ?.classList.contains('chat-widget--beside-toolbar'),
      ];
      const devToolbar = (
        fixture.componentInstance as unknown as {
          devToolbar: WritableSignal<Type<unknown> | null>;
        }
      ).devToolbar;
      devToolbar.set(null);
      TestBed.tick();
      expect(beside()).toEqual([false, false]);
      devToolbar.set(DevToolbarStub);
      TestBed.tick();
      expect(beside()).toEqual([true, true]);
    });
  });

  it('drops the frame for focus routes', async () => {
    signInAs('learner');
    const el = await open('/lesson/c1/l1');
    expect(el.querySelector('app-sidebar')).toBeNull();
    expect(el.querySelector('app-header')).toBeNull();
    expect(el.querySelector('main')).not.toBeNull();
    expect(el.querySelector('app-owl')).toBeNull();
  });

  it('drops the frame for bare routes and for visitors', async () => {
    const visitor = await open('/login');
    expect(visitor.querySelector('app-sidebar')).toBeNull();
    expect(visitor.querySelector('app-header')).toBeNull();
    expect(visitor.querySelector('main')).not.toBeNull();
    expect(visitor.querySelector('app-owl')).toBeNull();
  });

  describe('collapsing the sidebar', () => {
    const toggle = (el: HTMLElement) =>
      el.querySelector<HTMLButtonElement>(
        '.app-shell__sidebar .sidebar__toggle',
      );
    const rail = (el: HTMLElement) =>
      el.querySelector('.app-shell')?.classList.contains('app-shell--rail');

    it('collapses to an icon rail and expands again', async () => {
      signInAs('instructor');
      const el = await open('/learn');
      expect(toggle(el)?.getAttribute('aria-label')).toBe('Thu gọn thanh bên');
      expect(toggle(el)?.getAttribute('aria-expanded')).toBe('true');
      expect(rail(el)).toBe(false);

      toggle(el)?.click();
      TestBed.tick();
      expect(rail(el)).toBe(true);
      expect(el.querySelector('.sidebar--collapsed')).not.toBeNull();
      expect(toggle(el)?.getAttribute('aria-label')).toBe('Mở rộng thanh bên');
      expect(toggle(el)?.getAttribute('aria-expanded')).toBe('false');

      toggle(el)?.click();
      TestBed.tick();
      expect(rail(el)).toBe(false);
      expect(el.querySelector('.sidebar--collapsed')).toBeNull();
    });

    it('keeps every link named while collapsed', async () => {
      signInAs('instructor');
      const el = await open('/learn');
      toggle(el)?.click();
      TestBed.tick();
      expect(hrefs(el)).toHaveLength(15);
      expect(
        el.querySelector('nav a[href="/progress"]')?.textContent?.trim(),
      ).toBe('Tiến độ học tập');
    });

    it('remembers the choice in this browser', async () => {
      signInAs('instructor');
      const el = await open('/learn');
      toggle(el)?.click();
      expect(storage.get(SIDEBAR_COLLAPSED_KEY)).toBe('true');
      toggle(el)?.click();
      expect(storage.get(SIDEBAR_COLLAPSED_KEY)).toBe('false');
    });

    it('starts collapsed when the browser remembers it', async () => {
      storage.set(SIDEBAR_COLLAPSED_KEY, 'true');
      signInAs('instructor');
      expect(rail(await open('/learn'))).toBe(true);
    });
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
      signInAs('instructor');
      const el = await open('/learn');
      const button = el.querySelector<HTMLButtonElement>('app-header button');
      expect(button?.getAttribute('aria-label')).toBe('Mở menu điều hướng');
      expect(button?.getAttribute('aria-expanded')).toBe('false');

      await openDrawer(el);
      expect(dialog()?.querySelectorAll('nav a')).toHaveLength(15);
      expect(
        dialog()
          ?.querySelector('ul[aria-label="Cộng đồng"] a[href="/chat-room"]')
          ?.textContent?.trim(),
      ).toBe('Giờ ra chơi');
      expect(dialog()?.querySelector('.sidebar__toggle')).toBeNull();
      expect(button?.getAttribute('aria-expanded')).toBe('true');
    });

    it('closes the drawer when the user navigates', async () => {
      signInAs('instructor');
      const el = await open('/learn');
      await openDrawer(el);
      await router.navigateByUrl('/progress');
      TestBed.tick();
      await vi.waitFor(() => expect(dialog()).toBeNull());
      expect(
        el.querySelector('app-header button')?.getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('closes on Escape and gives focus back to the menu button', async () => {
      signInAs('instructor');
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

  describe('header', () => {
    let backend: HttpTestingController;
    beforeEach(() => (backend = TestBed.inject(HttpTestingController)));

    it('placeholder and form follow the role', async () => {
      signInAs('learner');
      const el = await open('/learn');
      const input = el.querySelector<HTMLInputElement>(
        'form[role="search"] input',
      );
      expect(input?.placeholder).toBe('Tìm khóa học, bài học…');
      signInAs('admin');
      TestBed.tick();
      expect(input?.placeholder).toBe('Tìm khóa học, người dùng, câu hỏi…');
    });

    it.each([
      ['learner', '/catalog'],
      ['viewer', '/reports/results'],
      ['admin', '/admin/courses'],
    ] as const)('sends a %s search to %s', async (role, path) => {
      signInAs(role);
      const el = await open('/learn');
      const input = el.querySelector<HTMLInputElement>('form input')!;
      input.value = ' core ';
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await vi.waitFor(() =>
        expect(router.url).toBe(
          `${path}?${role === 'viewer' ? 'userId' : 'q'}=core`,
        ),
      );
    });

    it('ignores an empty search', async () => {
      signInAs('learner');
      const el = await open('/learn');
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      TestBed.tick();
      expect(router.url).toBe('/learn');
    });

    it('labels the bell with the unread count and shows the dot', async () => {
      signInAs('learner');
      const el = await open('/learn', { notifications: 2, inbox: 0 });
      await vi.waitFor(() => {
        TestBed.tick();
        const bell = el.querySelector('app-notification-bell button');
        expect(bell?.getAttribute('aria-label')).toBe('Thông báo, 2 chưa đọc');
        expect(bell?.classList).toContain('icon-btn--dot');
      });
    });

    it('opens a dropdown with a link to the notifications page and does not navigate', async () => {
      signInAs('learner');
      const el = await open('/learn', { notifications: 0, inbox: 0 });
      el.querySelector<HTMLButtonElement>(
        'app-notification-bell button',
      )!.click();
      TestBed.tick();
      const all = document.querySelector<HTMLAnchorElement>(
        '.popover a[href="/notifications"]',
      );
      expect(all?.textContent).toContain('Xem tất cả thông báo');
      expect(router.url).toBe('/learn');
    });

    it('shows at most 20 notifications, unread first, and keeps a marked item in the dropdown', async () => {
      signInAs('learner');
      const el = await open('/learn');
      el.querySelector<HTMLButtonElement>(
        'app-notification-bell button',
      )!.click();
      TestBed.tick();
      const rows = Array.from({ length: 22 }, (_, index) => ({
        id: index + 1,
        rowVersion: 0,
        kind: 'BADGE_EARNED',
        subject: `Huy hiệu ${index + 1}`,
        status: index === 0 || index === 21 ? 'pending' : 'sent',
      }));
      const http = TestBed.inject(HttpTestingController);
      http
        .expectOne('/api/v1/me/learning/reminders/inbox')
        .flush(envelopeOk(rows));
      TestBed.tick();
      const list = () =>
        Array.from(document.querySelectorAll('.bell__list > li'));
      expect(list()).toHaveLength(20);
      expect(list()[0].textContent).toContain('Chưa đọc');
      expect(list()[1].textContent).toContain('Chưa đọc');
      expect(list()[2].textContent).toContain('Đã đọc');
      list()[0].querySelector<HTMLButtonElement>('button')!.click();
      TestBed.tick();
      http
        .expectOne('/api/v1/me/learning/reminders/22/read')
        .flush(envelopeOk({ ...rows[21], status: 'sent', rowVersion: 1 }));
      TestBed.tick();
      expect(
        list().filter((row) => row.textContent?.includes('Chưa đọc')),
      ).toHaveLength(1);
      expect(list()[1].textContent).toContain('Huy hiệu 22');
      expect(list()[1].textContent).toContain('Đã đọc');
      expect(router.url).toBe('/learn');
      expect(document.querySelector('.bell__list')).not.toBeNull();
    });

    it('closes the bell when opening the course named by a deadline reminder', async () => {
      signInAs('learner');
      const el = await open('/learn');
      el.querySelector<HTMLButtonElement>(
        'app-notification-bell button',
      )!.click();
      TestBed.tick();
      TestBed.inject(HttpTestingController)
        .expectOne('/api/v1/me/learning/reminders/inbox')
        .flush(
          envelopeOk([
            {
              id: 71,
              rowVersion: 0,
              recipientId: 81,
              kind: 'DEADLINE',
              status: 'pending',
              courseId: 42,
              courseTitle: 'Tín dụng doanh nghiệp',
              enrollmentId: 90,
              courseAvailable: true,
            },
          ]),
        );
      TestBed.tick();
      const link = document.querySelector<HTMLAnchorElement>(
        '.bell__list a[href="/course/42"]',
      );
      expect(link?.closest('li')?.textContent).toContain(
        'Tín dụng doanh nghiệp',
      );
      link!.click();
      await vi.waitFor(() => expect(router.url).toBe('/course/42'));
      expect(document.querySelector('.bell__list')).toBeNull();
    });

    it('reloads the counts after a navigation', async () => {
      signInAs('learner');
      await open('/learn', { notifications: 2, inbox: 0 });
      await router.navigateByUrl('/catalog');
      TestBed.tick();
      const reload = backend
        .match('/api/me/nav-counts')
        .filter((r) => !r.cancelled);
      expect(reload).toHaveLength(1);
      reload[0].flush(envelopeOk({ notifications: 0, inbox: 0 }));
    });

    describe('user menu', () => {
      const menu = () =>
        document.querySelector<HTMLElement>('#learner-account-menu');
      const items = () => Array.from(menu()?.querySelectorAll('button') ?? []);
      const trigger = (el: HTMLElement) =>
        el.querySelector<HTMLButtonElement>('.header__account-trigger');

      async function openMenu(el: HTMLElement) {
        trigger(el)?.click();
        TestBed.tick();
        await vi.waitFor(() => expect(menu()).not.toBeNull());
      }

      it('shows the role and account choices on hover without moving focus', async () => {
        signInAs('learner');
        const el = await open('/learn');
        expect(trigger(el)?.textContent).toContain(
          seedProfile(USERS.learner).fullName,
        );
        const search = el.querySelector<HTMLInputElement>(
          'input[type="search"]',
        );
        search?.focus();
        const hover = new Event('pointerenter');
        Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
        el.querySelector('[data-header-panel="account"]')?.dispatchEvent(hover);
        TestBed.tick();
        expect(document.activeElement).toBe(search);
        expect(menu()?.textContent).toContain(
          `${seedProfile(USERS.learner).fullName} · ${seedProfile(USERS.learner).email}`,
        );
        expect(menu()?.textContent).toContain('Vai trò: Học viên');
        expect(items().map((item) => item.textContent?.trim())).toEqual([
          'Hồ sơ cá nhân',
          'Hướng dẫn sử dụng',
          'Thông báo',
          'Đăng xuất',
        ]);
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        TestBed.tick();
        expect(menu()).toBeNull();
      });

      it('opens the profile page', async () => {
        signInAs('learner');
        const el = await open('/learn');
        await openMenu(el);
        items()[0].click();
        await vi.waitFor(() => expect(router.url).toBe('/profile'));
      });

      it('signs out only after the user confirms', async () => {
        signInAs('learner');
        const el = await open('/learn');
        await openMenu(el);
        items()
          .find((item) => item.textContent?.trim() === 'Đăng xuất')!
          .click();
        await vi.waitFor(() =>
          expect(
            document.querySelector('[role="alertdialog"]')?.textContent,
          ).toContain('Đăng xuất?'),
        );
        expect(session.signOut).not.toHaveBeenCalled();
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="alertdialog"] button',
          ),
        )
          .find((b) => b.textContent?.trim() === 'Đăng xuất')
          ?.click();
        await vi.waitFor(() => expect(router.url).toBe('/login'));
        expect(session.signOut).toHaveBeenCalledOnce();
        await vi.waitFor(() =>
          expect(document.body.textContent).toContain('Đã đăng xuất'),
        );
      });

      it('stays signed in when the user cancels', async () => {
        signInAs('learner');
        const el = await open('/learn');
        await openMenu(el);
        items()
          .find((item) => item.textContent?.trim() === 'Đăng xuất')!
          .click();
        await vi.waitFor(() =>
          expect(document.querySelector('[role="alertdialog"]')).not.toBeNull(),
        );
        const cancel = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            '[role="alertdialog"] button',
          ),
        ).find((b) => b.textContent?.includes('Hủy'));
        cancel?.click();
        await vi.waitFor(() =>
          expect(document.querySelector('[role="alertdialog"]')).toBeNull(),
        );
        expect(session.signOut).not.toHaveBeenCalled();
        expect(router.url).toBe('/learn');
      });
    });
  });

  describe('page behaviours', () => {
    it('has a skip link that moves focus to the main content', async () => {
      signInAs('learner');
      const el = await open('/learn');
      const skip = el.querySelector<HTMLAnchorElement>('a.skip-link');
      expect(skip?.textContent?.trim()).toBe('Bỏ qua tới nội dung chính');
      expect(skip?.getAttribute('href')).toBe('#main');
      skip?.click();
      expect(document.activeElement).toBe(el.querySelector('main#main'));
    });

    it('focuses the page heading after navigating', async () => {
      signInAs('learner');
      const fixture = TestBed.createComponent(AppShell);
      const root = fixture.nativeElement as HTMLElement;
      document.body.append(root);
      const go = async (url: string) => {
        await router.navigateByUrl(url);
        flushCounts();
        await fixture.whenStable();
        TestBed.tick();
      };
      await go('/flashcards');
      const flashcardHeading = root.querySelector('main h1');
      expect(flashcardHeading?.textContent).toContain('Flashcard ôn tập');
      expect(document.activeElement).toBe(flashcardHeading);
      await go('/403');
      const h1 = root.querySelector('main h1');
      expect(h1).not.toBeNull();
      expect(document.activeElement).toBe(h1);
      root.remove();
    });

    it('asks "Rời trang khi chưa lưu?" in a warning dialog', async () => {
      signInAs('learner');
      await open('/learn');
      const answers: boolean[] = [];
      TestBed.inject(LeavePrompt)
        .ask()
        .subscribe((leave) => answers.push(leave));
      const dialog = () =>
        document.querySelector<HTMLElement>('[role="alertdialog"]');
      await vi.waitFor(() => expect(dialog()).not.toBeNull());
      expect(dialog()?.textContent).toContain('Rời trang khi chưa lưu?');
      const press = (label: string) =>
        Array.from(dialog()?.querySelectorAll('button') ?? [])
          .find((b) => b.textContent?.trim() === label)
          ?.click();
      expect(dialog()?.textContent).toContain('Ở lại');
      press('Rời trang');
      await vi.waitFor(() => expect(answers).toEqual([true]));
    });

    describe('before unload', () => {
      const unload = () => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      it('lets the tab close when the page has nothing unsaved', async () => {
        signInAs('learner');
        await open('/learn');
        expect(unload()).toBe(false);
      });

      it('asks the browser to confirm when the page reports unsaved changes', async () => {
        signInAs('learner');
        const fixture = TestBed.createComponent(AppShell);
        await router.navigateByUrl('/learn');
        flushCounts();
        await fixture.whenStable();
        const store = fixture.debugElement.injector.get(ShellStore);
        store.activated({ hasUnsavedChanges: () => true });
        expect(unload()).toBe(true);
        store.deactivated();
        expect(unload()).toBe(false);
      });
    });
  });

  describe('offline banner', () => {
    const banner = (el: HTMLElement) => el.querySelector('.net-banner');

    it('is hidden while online', async () => {
      signInAs('learner');
      expect(banner(await open('/learn'))).toBeNull();
    });

    it.each([
      ['an app page', 'learner', '/learn'],
      ['a focus page', 'learner', '/lesson/c1/l1'],
    ] as const)(
      'shows on %s when the browser goes offline',
      async (_, role, url) => {
        signInAs(role);
        const el = await open(url);
        window.dispatchEvent(new Event('offline'));
        TestBed.tick();
        const alert = banner(el);
        expect(alert?.getAttribute('role')).toBe('alert');
        expect(alert?.textContent).toContain(
          'Mất kết nối mạng (mô phỏng). Dữ liệu đang nhập được giữ nguyên',
        );
        expect(alert?.querySelector('button')?.textContent?.trim()).toBe(
          'Kết nối lại',
        );
      },
    );

    it('goes away when the browser is back online', async () => {
      signInAs('learner');
      const el = await open('/learn');
      window.dispatchEvent(new Event('offline'));
      TestBed.tick();
      window.dispatchEvent(new Event('online'));
      TestBed.tick();
      expect(banner(el)).toBeNull();
    });

    it('goes away and says so when the user reconnects', async () => {
      signInAs('learner');
      const el = await open('/learn');
      window.dispatchEvent(new Event('offline'));
      TestBed.tick();
      el.querySelector<HTMLButtonElement>('.net-banner button')?.click();
      TestBed.tick();
      expect(banner(el)).toBeNull();
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('Đã kết nối lại'),
      );
    });
  });
});
