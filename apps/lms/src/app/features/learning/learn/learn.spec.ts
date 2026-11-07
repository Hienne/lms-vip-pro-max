import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  courseEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
} from '@lms/contracts';
import { backendRefusal, envelopeOk } from '@lms/mocks';
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

/**
 * Gives the first card of every `list` reply the cover asset 77, whose file the server answers
 * (`readable`) or refuses; everything else is the mock's.
 */
function withCover(
  handle: MockInstance<MockBackend['handle']>,
  list: unknown,
  readable: boolean,
) {
  const backend = TestBed.inject(MockBackend);
  URL.createObjectURL = vi.fn(() => 'blob:cover');
  URL.revokeObjectURL = vi.fn();
  handle.mockImplementation((endpoint, request) => {
    if (endpoint === courseEndpoints.getAssetContent) {
      return readable
        ? {
            status: 200,
            body: envelopeOk(null),
            file: new Blob(['png'], { type: 'image/png' }),
          }
        : backendRefusal('accessDenied');
    }
    const reply = MockBackend.prototype.handle.call(backend, endpoint, request);
    if (endpoint === list && reply && 'body' in reply) {
      const page = reply.body.data as { items: Record<string, unknown>[] };
      if (page.items[0]) page.items[0]['coverAssetId'] = 77;
    }
    return reply;
  });
}

describe('Learn', () => {
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
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      TestBed.tick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  async function open(username = 'hocvien', userId = '000004') {
    signInToMockBackend(username);
    fakeSession().user.set(seedProfile(userId));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/learn');
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const section = (name: string) =>
    el.querySelector<HTMLElement>(`section[aria-label="${name}"]`)!;
  const tab = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[ngTab]')).find((node) =>
      node.textContent?.includes(label),
    )!;
  const cards = () => el.querySelectorAll('app-course-tile');

  /** Fails one endpoint, leaving the rest as the mock answers them. */
  function fail(endpoint: unknown) {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((e, request) =>
      e === endpoint
        ? backendRefusal('internalError')
        : MockBackend.prototype.handle.call(backend, e, request),
    );
  }

  describe('a learner with a course in progress', () => {
    beforeEach(() => open());

    it('opens with the page title, the first thing to attend to and the resume card', () => {
      const hero = el.querySelector('app-learn-hero')!;
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(hero.querySelector('h1')?.textContent?.trim()).toBe('Học tập');
      expect(text()).not.toMatch(/Chào|hôm nay học gì/);
      const desc = hero.querySelector('ui-page-header .page-header__desc');
      expect(desc?.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(desc?.textContent).toMatch(/quá hạn|Khóa gần hạn nhất|theo kịp/);
      expect(
        hero.compareDocumentPosition(el.querySelector('app-learn-kpis')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      const resume = hero.querySelector<HTMLAnchorElement>(
        '.learn-hero__continue a',
      )!;
      expect(resume.textContent).toContain('Tiếp tục học');
      expect(resume.getAttribute('href')).toMatch(
        /^\/lesson\/\d+\/\d+(\?block=\d+)?$/,
      );
      expect(hero.querySelector('.learn-hero__lesson')?.textContent).toContain(
        ' · ',
      );
      expect(
        hero.querySelector('.learn-hero__continue ui-progress'),
      ).not.toBeNull();
    });

    const kpis = () =>
      Array.from(el.querySelectorAll('app-learn-kpis dl')).map((dl) =>
        Array.from(dl.querySelectorAll('dt, dd')).map((node) =>
          node.textContent?.replace(/\s+/g, ' ').trim(),
        ),
      );

    it('shows four figures: the assigned courses, the completion rate, the last and the best score', () => {
      expect(kpis()).toEqual([
        [
          'Khóa học được giao',
          expect.stringMatching(/^\d+$/),
          expect.stringMatching(/^\d+ bắt buộc · \d+ quá hạn$/),
        ],
        [
          'Tỷ lệ hoàn thành',
          expect.stringMatching(/^\d+%$/),
          expect.stringMatching(/^\d+\/\d+ khóa đã xong$/),
        ],
        [
          'Điểm kiểm tra gần nhất',
          '67%',
          'Chưa đạt · Luyện tập: Tổng quan hệ thống Core Banking',
        ],
        ['Điểm cao nhất', '90%', 'Đạt 1/5 bài kiểm tra'],
      ]);
    });

    it('names the last quiz at the end of the footnote and in the whole text as a title', () => {
      const last = el.querySelectorAll('app-learn-kpis dl')[2];
      expect(last.getAttribute('title')).toBe(
        'Luyện tập: Tổng quan hệ thống Core Banking',
      );
    });

    it('reads the completion rate from the dashboard and computes no percent', () => {
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.dashboard),
      ).toHaveLength(1);
      const [, rate, done] = kpis()[1];
      const [completed, total] = (done ?? '').match(/\d+/g)!.map(Number);
      expect(rate).toBe(`${Math.round((completed / total) * 100)}%`);
    });

    it('links the figures to the assigned catalogue and the progress page, and leaves the completion rate plain', () => {
      expect(
        Array.from(el.querySelectorAll('app-learn-kpis a')).map((a) =>
          a.getAttribute('href'),
        ),
      ).toEqual(['/catalog?scope=assigned', '/progress', '/progress']);
    });

    it('leaves the counts, the score figures and the unavailable note to the progress page', () => {
      expect(el.querySelector('app-progress-counts')).toBeNull();
      expect(el.querySelector('app-score-figures')).toBeNull();
      expect(text()).not.toContain('Giờ học sẽ hiển thị');
    });

    it('puts the best score of the final exam on the course card', () => {
      expect(text()).toContain('Điểm cao nhất 40%');
    });

    it('lists the in-progress courses first and the status counts on the tabs', () => {
      expect(cards().length).toBeGreaterThan(0);
      expect(tab('Đang học').textContent).toMatch(/Đang học\s*\d+/);
      expect(tab('Bắt buộc').textContent).toMatch(/Bắt buộc\s*\d+/);
      expect(tab('Được giao').textContent).toMatch(/Được giao\s*\d+/);
    });

    it('changes the grid with the tab and says so when a tab has none', async () => {
      tab('Chưa bắt đầu').click();
      await settle();
      expect(
        handle.mock.calls.some(
          ([e, r]) =>
            e === learnerEndpoints.myCourses &&
            r.query['learningStatus'] === 'not_started' &&
            r.query['size'] === '6',
        ),
      ).toBe(true);
      tab('Bắt buộc').click();
      await settle();
      expect(
        handle.mock.calls.some(
          ([e, r]) =>
            e === learnerEndpoints.myCourses &&
            r.query['requirement'] === 'mandatory',
        ),
      ).toBe(true);
      tab('Được giao').click();
      await settle();
      expect(
        handle.mock.calls.some(
          ([e, r]) =>
            e === learnerEndpoints.myCourses && r.query['assigned'] === 'true',
        ),
      ).toBe(true);
    });

    it('keeps the tabs on one scrolling row instead of wrapping them', () => {
      expect(el.querySelector('.tabs')!.classList).not.toContain('tabs--wrap');
    });

    it('links "Xem tất cả" to the assigned catalogue', () => {
      const link = Array.from(el.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Xem tất cả'),
      );
      expect(link?.getAttribute('href')).toBe('/catalog?scope=assigned');
    });

    it('lists what falls due with a link to each course, and the first reminders', () => {
      const due = el.querySelectorAll('.learn__due li');
      expect(due.length).toBeGreaterThan(0);
      expect(due[0].querySelector('a')?.getAttribute('href')).toMatch(
        /^\/course\/\d+$/,
      );
      expect(due[0].querySelector('app-due-date')).not.toBeNull();
      expect(el.querySelectorAll('app-reminder-item')).toHaveLength(3);
      const disclosure = el.querySelector<HTMLDetailsElement>(
        '.learn__reminder-disclosure',
      )!;
      expect(disclosure.open).toBe(false);
      disclosure.querySelector('summary')!.click();
      expect(disclosure.open).toBe(true);
      expect(
        Array.from(el.querySelectorAll('aside a')).some(
          (a) => a.getAttribute('href') === '/notifications',
        ),
      ).toBe(true);
    });
  });

  describe('course covers', () => {
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });

    it('shows the uploaded cover on the first tile and no cover or placeholder art on the others', async () => {
      withCover(handle, learnerEndpoints.myCourses, true);
      await open();
      const tiles = Array.from(cards());
      expect(tiles.length).toBeGreaterThan(1);
      expect(
        tiles[0].querySelector('img.course-tile__image')?.getAttribute('src'),
      ).toBe('blob:cover');
      for (const tile of tiles.slice(1)) {
        expect(tile.querySelector('img')).toBeNull();
        expect(tile.querySelector('.course-tile__cover')).toBeNull();
      }
      expect(
        handle.mock.calls.filter(
          ([e]) => e === courseEndpoints.getAssetContent,
        )[0][1].params,
      ).toEqual({ assetId: '77' });
    });

    it('drops the cover when the server refuses an uploaded cover', async () => {
      withCover(handle, learnerEndpoints.myCourses, false);
      await open();
      expect(cards().length).toBeGreaterThan(0);
      expect(el.querySelector('app-course-tile img')).toBeNull();
      expect(
        el.querySelector('app-course-tile .course-tile__cover'),
      ).toBeNull();
    });
  });

  describe('what the page leaves to the progress page', () => {
    beforeEach(() => open());

    it('has no programme journey and no competency card, and reads neither', () => {
      expect(text()).not.toContain('Lộ trình theo chương trình');
      expect(el.querySelector('#learn-journey')).toBeNull();
      expect(el.querySelector('#learn-competency')).toBeNull();
      expect(el.querySelector('app-competency-view')).toBeNull();
      expect(
        handle.mock.calls.some(
          ([e]) =>
            e === learnerEndpoints.dashboardPrograms ||
            e === learnerQuizEndpoints.myCompetency,
        ),
      ).toBe(false);
    });

    it('links the two score figures to the progress page', () => {
      const links = Array.from(
        el.querySelectorAll<HTMLAnchorElement>('app-learn-kpis a'),
      ).map((a) => a.getAttribute('href'));
      expect(links.filter((href) => href === '/progress')).toHaveLength(2);
    });
  });

  describe('the side column', () => {
    beforeEach(() => open());

    it("shows each course's percent after its due date, as the card sends it", () => {
      const rows = Array.from(el.querySelectorAll('.learn__due li'));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.querySelector('.learn__due-pct')?.textContent).toMatch(
          /^\d+%$/,
        );
        expect(
          row
            .querySelector('app-due-date')!
            .compareDocumentPosition(row.querySelector('.learn__due-pct')!) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
    });

    it('lists the three quick tools after the deadline panel and its reminders', () => {
      const tools = el.querySelector('#learn-tools')!;
      expect(tools.tagName).toBe('H2');
      expect(tools.textContent).toContain('Công cụ học nhanh');
      const links = Array.from(tools.closest('section')!.querySelectorAll('a'));
      expect(
        links.map((a) => [
          a.querySelector('.learn__tool-title')?.textContent?.trim(),
          a.getAttribute('href'),
        ]),
      ).toEqual([
        ['Hỏi trợ lý AI', '/assistant'],
        ['Ghi chú & đánh dấu', '/saved'],
        ['Chứng nhận', '/certificates'],
      ]);
      expect(links[0].textContent).toContain('Tra cứu tài liệu có trích nguồn');
      expect(links[1].textContent).toContain('Mở đúng trang / mốc video');
      expect(links[2].textContent).toContain(
        'Chứng nhận các khóa đã hoàn thành',
      );
      expect(links.every((a) => a.querySelector('ui-icon'))).toBe(true);
      expect(tools.closest('section')!.hasAttribute('uicard')).toBe(true);
      const position = (selector: string) =>
        el.querySelector(selector)!.compareDocumentPosition(tools);
      expect(
        position('#learn-due') & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        el.querySelector('#learn-reminders')!.compareDocumentPosition(tools) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('has no flashcards link: that screen does not exist yet', () => {
      expect(text()).not.toMatch(/flashcard/i);
    });
  });

  describe('the points figure', () => {
    const reward = () => el.querySelector('.learn-hero__reward');
    const shown = () => reward()?.textContent?.replace(/\s+/g, ' ').trim();

    /** Answers the points read with fixed figures, the rest as the mock does. */
    function answerPoints(data: unknown) {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.myPoints
          ? { status: 200, body: envelopeOk(data) }
          : MockBackend.prototype.handle.call(backend, e, request),
      );
    }

    it('sits beside the page title and links to the leaderboard', async () => {
      await open();
      expect(shown()).toBe('80 điểm thưởng · chuỗi 2 ngày');
      expect(reward()?.getAttribute('href')).toBe('/leaderboard');
      expect(reward()?.getAttribute('aria-label')).toContain(
        'xem bảng xếp hạng',
      );
      expect(reward()?.closest('app-learn-hero')).not.toBeNull();
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.myPoints),
      ).toHaveLength(1);
    });

    it('shows a learner with no points as 0 and a streak of 0 days', async () => {
      answerPoints({
        total: 0,
        parts: {
          lessons: 0,
          quizzes: 0,
          firstTryBonus: 0,
          courses: 0,
          community: 0,
          adjustments: 0,
        },
        streakDays: 0,
      });
      await open();
      expect(shown()).toBe('0 điểm thưởng · chuỗi 0 ngày');
    });

    it('shows for a learner whose courses have no quiz', async () => {
      await open('giangvien', '000005');
      expect(shown()).toBe('40 điểm thưởng · chuỗi 2 ngày');
    });

    it('says so with a retry when the read fails, and nothing else fails', async () => {
      fail(learnerEndpoints.myPoints);
      await open();
      expect(reward()?.tagName).toBe('DIV');
      expect(shown()).toContain('Không tải được điểm thưởng');
      expect(reward()?.querySelector('button')?.textContent).toContain(
        'Thử lại',
      );
      expect(text().match(/Không tải được/g)).toHaveLength(1);
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);
      expect(cards().length).toBeGreaterThan(0);
    });

    it('does not wait for the summary', async () => {
      fail(learnerEndpoints.progressSummary);
      await open();
      expect(shown()).toBe('80 điểm thưởng · chuỗi 2 ngày');
    });
  });

  describe('a learner who has not taken a quiz yet', () => {
    it('combines empty quiz results without a pass verdict', async () => {
      await open('hocvien.tichhop', '000007');
      const cells = Array.from(
        el.querySelectorAll(
          'app-learn-kpis a:nth-of-type(n+2) dt, app-learn-kpis a:nth-of-type(n+2) dd',
        ),
      ).map((node) => node.textContent?.replace(/\s+/g, ' ').trim());
      expect(cells).toEqual(['Kết quả kiểm tra', '—', 'Chưa làm bài kiểm tra']);
      expect(el.querySelector('app-learn-kpis')!.textContent).not.toMatch(
        /Đạt ·/,
      );
    });
  });

  describe('a learner whose courses have no quiz', () => {
    it('shows one empty score figure without an error', async () => {
      await open('giangvien', '000005');
      const scores = Array.from(
        el.querySelectorAll('app-learn-kpis a:nth-of-type(n+2) dd'),
      ).map((node) => node.textContent?.replace(/\s+/g, ' ').trim());
      expect(scores).toEqual(['—', 'Chưa có bài kiểm tra']);
      expect(text()).not.toContain('Không tải được');
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(3);
    });
  });

  describe('a failed dashboard', () => {
    it('leaves three figures and gives the completion rate its own retry', async () => {
      fail(learnerEndpoints.dashboard);
      await open();
      const kpi = el.querySelector('app-learn-kpis')!;
      expect(kpi.querySelectorAll('dt')).toHaveLength(4);
      expect(kpi.textContent).toContain('Tỷ lệ hoàn thành');
      expect(kpi.textContent).toContain('Không tải được');
      expect(kpi.textContent).toContain('Điểm cao nhất');
      expect(cards().length).toBeGreaterThan(0);

      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(kpi.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(kpi.textContent).not.toContain('Không tải được');
      expect(kpi.textContent).toMatch(/Tỷ lệ hoàn thành \d/);
    });
  });

  describe('a learner with nothing in progress', () => {
    it('is offered the catalogue first', async () => {
      const backend = TestBed.inject(MockBackend);
      const none = {
        status: 200,
        body: envelopeOk({
          items: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
        }),
      };
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.myCourses
          ? none
          : MockBackend.prototype.handle.call(backend, e, request),
      );
      await open();
      const link = el.querySelector<HTMLAnchorElement>(
        'app-learn-hero .learn-hero__continue a',
      )!;
      expect(link.textContent).toContain('Khám phá khóa học');
      expect(link.getAttribute('href')).toBe('/catalog');
      expect(text()).toContain('Không có khóa học ở trạng thái này.');
      expect(text()).toContain('Không có khóa học sắp đến hạn.');
    });
  });

  describe('reminders the server refuses with a 403', () => {
    it('leave no reminders section and no error for it', async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.reminders
          ? backendRefusal('accessDenied')
          : MockBackend.prototype.handle.call(backend, e, request),
      );
      await open();
      expect(el.querySelectorAll('app-reminder-item')).toHaveLength(0);
      expect(text()).not.toContain('Nhắc hạn');
      expect(text()).not.toContain('Không tải được nhắc hạn');
      expect(cards().length).toBeGreaterThan(0);
    });
  });

  describe('failed reads', () => {
    it('fail one section at a time, each with its own retry', async () => {
      fail(learnerEndpoints.progressSummary);
      await open();
      expect(section('Số liệu học tập').textContent).toContain(
        'Không tải được số liệu học tập',
      );
      expect(el.querySelector('app-learn-hero')).not.toBeNull();
      expect(cards().length).toBeGreaterThan(0);
      expect(el.querySelectorAll('app-reminder-item')).toHaveLength(3);

      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(section('Số liệu học tập').querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);
    });

    it('shows the due list error without touching the rest', async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.myCourses && request.query['size'] === '10'
          ? backendRefusal('internalError')
          : MockBackend.prototype.handle.call(backend, e, request),
      );
      await open();
      expect(text()).toContain('Không tải được hạn hoàn thành');
      expect(cards().length).toBeGreaterThan(0);
    });
  });
});
