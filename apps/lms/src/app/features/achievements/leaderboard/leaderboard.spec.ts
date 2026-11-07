import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';
import {
  LeaderboardStore,
  XP_NOTICE_STORAGE_KEY,
} from './data-access/leaderboard.store';
import { Leaderboard } from './leaderboard';

describe('Leaderboard', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let handle: MockInstance<MockBackend['handle']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
    localStorage.removeItem(XP_NOTICE_STORAGE_KEY);
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(
    url = '/leaderboard',
    username = 'hocvien',
    userId = '000004',
  ) {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element = el) =>
    node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const rows = () =>
    Array.from(
      el.querySelectorAll('.leaderboard__ranking > ol:first-of-type li'),
    );
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);
  const lastQuery = () =>
    calls(learnerEndpoints.leaderboard).at(-1)?.[1].query as Record<
      string,
      string
    >;
  const store = () => harness.routeDebugElement!.injector.get(LeaderboardStore);
  const option = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[role="option"]')).find((o) =>
      o.textContent?.includes(label),
    )!;

  /** Lets the mock answer one endpoint with a refusal, the rest as usual. */
  function fail(endpoint: unknown, key: Parameters<typeof backendRefusal>[0]) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === endpoint
        ? backendRefusal(key)
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  describe('the Đơn vị board of a learner', () => {
    beforeEach(() => open());

    it('titles the page and explains how points are earned', () => {
      expect(el.querySelector('h1')?.textContent).toContain(
        'Bảng xếp hạng & thành tích',
      );
      expect(text()).toContain(
        'XP được ghi tự động khi bạn hoàn thành bài học, đạt bài kiểm tra hoặc hoàn thành khóa học.',
      );
    });

    it('offers the three scopes and starts on Đơn vị', () => {
      const labels = Array.from(el.querySelectorAll('[role="option"]')).map(
        (o) => text(o),
      );
      expect(labels).toEqual(['Nhóm của tôi', 'Đơn vị', 'Toàn hệ thống']);
      expect(option('Đơn vị').getAttribute('aria-selected')).toBe('true');
      expect(lastQuery()).toMatchObject({
        scope: 'org',
        page: '0',
        size: '20',
      });
    });

    it('counts the learners and lists them in the server order with ties sharing a rank', () => {
      expect(text(el.querySelector('.leaderboard__count')!)).toBe('5 học viên');
      expect(
        rows().map((row) => [
          text(row.querySelector('.leaderboard__rank')!),
          text(row.querySelector('.leaderboard__title')!),
        ]),
      ).toEqual([
        ['1', 'Học viên tích hợp Demo'],
        ['2', 'Học viên tiền gửi Demo (bạn)'],
        ['2', 'Học viên tín dụng Demo'],
        ['4', 'Giảng viên Demo'],
        ['5', 'Học viên thẻ Demo'],
      ]);
    });

    it('shows the team and the streak under each name, and the points', () => {
      const [first, second] = rows();
      expect(text(first.querySelector('.leaderboard__meta')!)).toBe(
        'Nhóm Tích hợp Core Banking · chuỗi 2 ngày',
      );
      expect(text(first.querySelector('.leaderboard__score')!)).toBe('90 điểm');
      expect(text(second.querySelector('.leaderboard__score')!)).toBe(
        '80 điểm',
      );
    });

    it('marks only the caller: the selected-row token, aria-current and "(bạn)"', () => {
      const marked = rows().filter((row) => row.hasAttribute('aria-current'));
      expect(marked).toHaveLength(1);
      expect(marked[0].getAttribute('aria-current')).toBe('true');
      expect(marked[0].classList.contains('leaderboard__row--me')).toBe(true);
      expect(text(marked[0])).toContain('(bạn)');
      expect(
        text(el.querySelector('.leaderboard__ranking')!).match(/\(bạn\)/g),
      ).toHaveLength(1);
    });

    it('writes "(bạn)" in the same wrapping line as the name, with no truncating element around either', () => {
      const you = el.querySelector('.leaderboard__you')!;
      expect(you.closest('.leaderboard__title')).not.toBeNull();
      expect(you.closest('[title]')).toBeNull();
    });

    it('does not list the caller twice, since the row is on the page', () => {
      expect(text()).not.toContain('Vị trí của bạn');
    });

    it('shows the points card: the total, the rank in this scope and the four parts', () => {
      const card = el.querySelector('.leaderboard__points')!;
      expect(text(card.querySelector('.leaderboard__points-title')!)).toBe(
        'XP của bạn · hạng 2',
      );
      expect(text(card.querySelector('.leaderboard__total')!)).toBe('80');
      expect(
        Array.from(card.querySelectorAll('.leaderboard__part')).map((part) => [
          text(part.querySelector('dt')!),
          text(part.querySelector('dd')!),
        ]),
      ).toEqual([
        ['Bài học hoàn thành', '+30'],
        ['Bài kiểm tra đạt', '+30'],
        ['Đạt ngay lần đầu', '+20'],
        ['Khóa học hoàn thành', '+0'],
        ['Cộng đồng', '+0'],
        ['Điều chỉnh', '+0'],
      ]);
    });

    it('reads the points once and the board once', () => {
      expect(calls(learnerEndpoints.myPoints)).toHaveLength(1);
      expect(calls(learnerEndpoints.leaderboard)).toHaveLength(1);
    });
  });

  describe('choosing a scope', () => {
    it('asks the server for it, shows its rows, and keeps it in the URL', async () => {
      await open();
      option('Nhóm của tôi').click();
      await settle();
      expect(lastQuery()).toMatchObject({ scope: 'team', page: '0' });
      expect(TestBed.inject(Router).url).toBe('/leaderboard?scope=team');
      expect(rows()).toHaveLength(1);
      expect(text(el.querySelector('.leaderboard__count')!)).toBe('1 học viên');
      expect(text(el.querySelector('.leaderboard__points-title')!)).toBe(
        'XP của bạn · hạng 1',
      );
    });

    it('leaves the default scope out of the URL', async () => {
      await open('/leaderboard?scope=all');
      option('Đơn vị').click();
      await settle();
      expect(lastQuery()).toMatchObject({ scope: 'org' });
      expect(TestBed.inject(Router).url).toBe('/leaderboard');
    });

    it('opens a shared link on its scope', async () => {
      await open('/leaderboard?scope=all');
      expect(option('Toàn hệ thống').getAttribute('aria-selected')).toBe(
        'true',
      );
      expect(lastQuery()).toMatchObject({ scope: 'all' });
    });

    it('opens an unknown scope on Đơn vị', async () => {
      await open('/leaderboard?scope=galaxy');
      expect(option('Đơn vị').getAttribute('aria-selected')).toBe('true');
      expect(lastQuery()).toMatchObject({ scope: 'org' });
    });

    it('starts again at the first page', async () => {
      await open('/leaderboard?page=2');
      expect(lastQuery()).toMatchObject({ page: '1' });
      option('Toàn hệ thống').click();
      await settle();
      expect(lastQuery()).toMatchObject({ scope: 'all', page: '0' });
      expect(TestBed.inject(Router).url).toBe('/leaderboard?scope=all');
    });
  });

  describe('a learner alone in their team', () => {
    it('lists only themself, ranked first', async () => {
      await open('/leaderboard?scope=team', 'giangvien', '000005');
      expect(rows()).toHaveLength(1);
      expect(text(rows()[0].querySelector('.leaderboard__rank')!)).toBe('1');
      expect(text(el.querySelector('.leaderboard__count')!)).toBe('1 học viên');
    });
  });

  describe('a page that does not hold the caller', () => {
    it('adds "Vị trí của bạn" with the caller row after the list', async () => {
      await open('/leaderboard?scope=all&page=3');
      expect(lastQuery()).toMatchObject({ scope: 'all', page: '2' });
      expect(rows()).toEqual([]);
      expect(text()).toContain('Vị trí của bạn');
    });
  });

  describe('the three states', () => {
    it('says so, with a retry, when the board fails, and keeps the points card', async () => {
      fail(learnerEndpoints.leaderboard, 'internalError');
      await open();
      expect(text(el.querySelector('.leaderboard__ranking')!)).toContain(
        'Không tải được bảng xếp hạng',
      );
      expect(el.querySelectorAll('.leaderboard__ranking button')).toHaveLength(
        1,
      );
      expect(text(el.querySelector('.leaderboard__total')!)).toBe('80');
      // The rank is the board's: without it the title carries none.
      expect(text(el.querySelector('.leaderboard__points-title')!)).toBe(
        'XP của bạn',
      );
    });

    it('reloads the board when retry is pressed', async () => {
      fail(learnerEndpoints.leaderboard, 'internalError');
      await open();
      handle.mockImplementation((e, request) =>
        MockBackend.prototype.handle.call(
          TestBed.inject(MockBackend),
          e,
          request,
        ),
      );
      el.querySelector<HTMLButtonElement>(
        '.leaderboard__ranking button',
      )!.click();
      await settle();
      expect(rows().length).toBe(5);
    });

    it('says so, with a retry, when the points fail, and keeps the board', async () => {
      fail(learnerEndpoints.myPoints, 'internalError');
      await open();
      expect(text(el.querySelector('.leaderboard__points')!)).toContain(
        'Không tải được điểm thưởng',
      );
      expect(el.querySelector('.leaderboard__points button')).not.toBeNull();
      expect(rows().length).toBe(5);
    });

    it('refuses the route before calling the leaderboard API for a non-learner', async () => {
      await open('/leaderboard', 'quantri', '000002');
      expect(TestBed.inject(Router).url).toBe('/403');
      expect(calls(learnerEndpoints.leaderboard)).toHaveLength(0);
    });
  });

  describe('the store', () => {
    it('moves to a page, keeps the scope, and writes the page to the URL', async () => {
      await open('/leaderboard?scope=all');
      store().goToPage(2);
      await settle();
      expect(lastQuery()).toMatchObject({ scope: 'all', page: '1' });
      expect(TestBed.inject(Router).url).toBe('/leaderboard?scope=all&page=2');
      expect(store().page$()).toBe(2);
    });

    it('ignores a scope it does not know', async () => {
      await open();
      const before = calls(learnerEndpoints.leaderboard).length;
      store().selectScope('galaxy');
      await settle();
      expect(store().scope$()).toBe('org');
      expect(calls(learnerEndpoints.leaderboard)).toHaveLength(before);
    });

    it('reads a bad page of the URL as the first', async () => {
      await open('/leaderboard?page=abc');
      expect(lastQuery()).toMatchObject({ page: '0' });
    });

    it('exposes the four parts in the mockup order', async () => {
      await open();
      expect(
        store()
          .parts$()
          .map((part) => part.key),
      ).toEqual([
        'lessons',
        'quizzes',
        'firstTryBonus',
        'courses',
        'community',
        'adjustments',
      ]);
    });
  });

  describe('the notice that points became XP', () => {
    const notice = () => el.querySelector('.leaderboard__notice');

    it('shows once, says a streak earns no XP, and is remembered once dismissed', async () => {
      await open();
      expect(text(notice()!)).toContain('Chuỗi ngày học vẫn được ghi nhận');
      expect(text(notice()!)).toContain('không cộng XP');

      el.querySelector<HTMLButtonElement>(
        '.leaderboard__notice button',
      )!.click();
      await settle();
      expect(notice()).toBeNull();
      expect(localStorage.getItem(XP_NOTICE_STORAGE_KEY)).toBe('1');
    });
  });
});

describe('Leaderboard with a fake store', () => {
  const me = {
    rank: null,
    userId: '000004',
    fullName: 'Học viên tiền gửi Demo',
    teamName: null,
    points: 80,
    streakDays: 2,
    me: true,
  };

  function render(scope: string, overrides: Record<string, unknown>) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(Leaderboard, {
      set: {
        providers: [
          {
            provide: LeaderboardStore,
            useValue: {
              scope$: signal(scope),
              page$: signal(1),
              boardError$: signal(undefined),
              isBoardLoading$: signal(false),
              rows$: signal([]),
              total$: signal(0),
              me$: signal(undefined),
              isMeOffPage$: signal(false),
              isEmpty$: signal(false),
              pointsError$: signal(undefined),
              isPointsLoading$: signal(false),
              points$: signal(undefined),
              rank$: signal(null),
              parts$: signal([]),
              isXpNoticeShown$: signal(false),
              ...Object.fromEntries(
                Object.entries(overrides).map(([key, value]) => [
                  key,
                  signal(value),
                ]),
              ),
            },
          },
        ],
      },
    });
    const fixture = TestBed.createComponent(Leaderboard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows a skeleton for the board and for the points, and no count', () => {
    const node = render('org', {
      isBoardLoading$: true,
      isPointsLoading$: true,
    });
    expect(
      node.querySelector('.leaderboard__ranking-placeholder'),
    ).not.toBeNull();
    expect(
      node.querySelector('.leaderboard__points-placeholder'),
    ).not.toBeNull();
    expect(node.querySelector('.leaderboard__count')).toBeNull();
    expect(node.querySelector('.leaderboard__list')).toBeNull();
  });

  it('tells a caller with no team why the team board is empty, and shows their own row with a dash', () => {
    const node = render('team', {
      isEmpty$: true,
      isMeOffPage$: true,
      me$: me,
    });
    const text = node.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Bạn chưa thuộc nhóm nào');
    expect(text).toContain('0 học viên');
    expect(text).toContain('Vị trí của bạn');
    expect(node.querySelector('.leaderboard__rank')?.textContent?.trim()).toBe(
      '—',
    );
    expect(node.querySelector('[aria-current="true"]')).not.toBeNull();
  });

  it('says plainly that an org or system board has nobody when it is empty', () => {
    const node = render('org', { isEmpty$: true });
    expect(node.textContent).toContain(
      'Chưa có học viên nào trong phạm vi này.',
    );
    expect(node.textContent).not.toContain('Bạn chưa thuộc nhóm nào');
  });

  it('pages a board of more than twenty learners', () => {
    const node = render('all', { total$: 45 });
    expect(node.querySelector('ui-pagination')).not.toBeNull();
    expect(node.querySelector('ui-pagination')?.textContent).toContain(
      '1–20 / 45',
    );
  });
});
