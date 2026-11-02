import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints, learnerQuizEndpoints } from '@lms/contracts';
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
  const cards = () => el.querySelectorAll('app-course-card');

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

    it('puts the continue card first, below only the heading', () => {
      expect(el.querySelector('h1')?.textContent).toContain(
        'Trang chủ học tập',
      );
      const first = el.querySelector('app-continue-card')!;
      expect(
        first.compareDocumentPosition(el.querySelector('app-learn-kpis')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(first.querySelector('a')?.textContent).toContain('Tiếp tục học');
      expect(first.querySelector('a')?.getAttribute('href')).toMatch(
        /^\/lesson\/\d+\/\d+(\?block=\d+)?$/,
      );
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
          expect.stringMatching(/^\d+(,\d+)?%$/),
          expect.stringMatching(/^\d+\/\d+ khóa đã xong$/),
        ],
        [
          'Điểm kiểm tra gần nhất',
          '66,67%',
          'Chưa đạt · Luyện tập: Tổng quan hệ thống Core Banking',
        ],
        ['Điểm cao nhất', '90%', 'Đạt 1/5 bài kiểm tra'],
      ]);
    });

    it('reads the completion rate from the dashboard and computes no percent', () => {
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.dashboard),
      ).toHaveLength(1);
      const [, rate, done] = kpis()[1];
      const [completed, total] = (done ?? '').match(/\d+/g)!.map(Number);
      expect(rate).toBe(
        `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(
          Math.round((completed / total) * 10_000) / 100,
        )}%`,
      );
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
      expect(
        Array.from(el.querySelectorAll('aside a')).some(
          (a) => a.getAttribute('href') === '/notifications',
        ),
      ).toBe(true);
    });
  });

  describe('the course tabs', () => {
    it('keep to one line: compact spacing, no wrapping row', async () => {
      await open();
      const list = el.querySelector('[role="tablist"]')!;
      expect(list.classList.contains('tabs--compact')).toBe(true);
      expect(list.classList.contains('tabs--wrap')).toBe(false);
      expect(el.querySelectorAll('[ngTab]')).toHaveLength(5);
    });
  });

  describe('the programme journey', () => {
    const journey = () =>
      el.querySelector<HTMLElement>(
        'section[aria-labelledby="learn-programs"]',
      );
    /** Answers the programmes with a fixed page, the rest as the mock does. */
    function answerPrograms(items: unknown[]) {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.dashboardPrograms
          ? {
              status: 200,
              body: envelopeOk({
                items,
                page: 0,
                size: 100,
                totalElements: items.length,
                totalPages: 1,
              }),
            }
          : MockBackend.prototype.handle.call(backend, e, request),
      );
    }

    const group = {
      id: '1',
      name: 'Nền tảng nghiệp vụ Core Banking',
      enrollments: 3,
      learners: 1,
      courses: 3,
      completed: 1,
      inProgress: 1,
      notStarted: 1,
      overdue: 1,
      averageProgress: 50,
      completionRate: 33.33,
    };

    it('lists a row per programme: name, the server percent, a bar and the courses done', async () => {
      answerPrograms([
        group,
        {
          ...group,
          id: '2',
          name: 'Vận hành',
          courses: 2,
          completed: 0,
          averageProgress: 12.5,
        },
      ]);
      await open();
      const rows = Array.from(journey()!.querySelectorAll('li'));
      expect(
        rows.map((row) =>
          ['.learn__step-name', '.learn__step-pct', '.learn__muted'].map(
            (selector) => row.querySelector(selector)?.textContent?.trim(),
          ),
        ),
      ).toEqual([
        ['Nền tảng nghiệp vụ Core Banking', '50%', '1/3 khóa đã xong'],
        ['Vận hành', '12,5%', '0/2 khóa đã xong'],
      ]);
      expect(rows[0].querySelector('ui-progress')).not.toBeNull();
      expect(
        el
          .querySelector('#learn-competency')!
          .compareDocumentPosition(journey()!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        handle.mock.calls.some(
          ([e, r]) =>
            e === learnerEndpoints.dashboardPrograms &&
            r.query['size'] === '100',
        ),
      ).toBe(true);
    });

    it('serves the mock learner their programmes', async () => {
      await open();
      expect(journey()!.querySelectorAll('li').length).toBeGreaterThan(0);
    });

    it('is absent when the page is empty', async () => {
      answerPrograms([]);
      await open();
      expect(journey()).toBeNull();
      expect(text()).not.toContain('Lộ trình theo chương trình');
      expect(text()).not.toContain('Không tải được');
    });

    it('fails alone, with a retry', async () => {
      fail(learnerEndpoints.dashboardPrograms);
      await open();
      expect(journey()!.textContent).toContain('Không tải được lộ trình');
      expect(cards().length).toBeGreaterThan(0);
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);

      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(journey()!.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(journey()!.querySelectorAll('li').length).toBeGreaterThan(0);
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

    it('lists "Công cụ học nhanh" with two links, below the due list and above the reminders', () => {
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
        ['Ghi chú & đánh dấu', '/saved'],
        ['Chứng nhận', '/certificates'],
      ]);
      expect(links[0].textContent).toContain('Mở đúng trang / mốc video');
      expect(links[1].textContent).toContain(
        'Chứng nhận các khóa đã hoàn thành',
      );
      expect(links.every((a) => a.querySelector('ui-icon'))).toBe(true);
      const position = (selector: string) =>
        el.querySelector(selector)!.compareDocumentPosition(tools);
      expect(
        position('#learn-due') & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        tools.compareDocumentPosition(el.querySelector('#learn-reminders')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('has no AI assistant and no flashcards link', () => {
      expect(text()).not.toMatch(/trợ lý AI|flashcard/i);
    });
  });

  describe('the points figure', () => {
    const figure = () => el.querySelector('app-points-figure');
    const cells = () =>
      Array.from(figure()!.querySelectorAll('dt, dd')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      );

    /** Answers the points read with fixed figures, the rest as the mock does. */
    function answerPoints(data: unknown) {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerEndpoints.myPoints
          ? { status: 200, body: envelopeOk(data) }
          : MockBackend.prototype.handle.call(backend, e, request),
      );
    }

    it('follows the continue card with the total and the streak, a link to the leaderboard', async () => {
      await open();
      expect(cells()).toEqual(['Điểm thưởng', '80', 'Chuỗi 2 ngày']);
      expect(figure()!.querySelector('a')?.getAttribute('href')).toBe(
        '/leaderboard',
      );
      const card = el.querySelector('app-continue-card')!;
      expect(card.parentElement).toBe(figure()!.parentElement);
      expect(
        card.compareDocumentPosition(figure()!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        figure()!.compareDocumentPosition(el.querySelector('app-learn-kpis')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        handle.mock.calls.filter(([e]) => e === learnerEndpoints.myPoints),
      ).toHaveLength(1);
    });

    it('shows a learner with no points as 0 and a streak of 0 days', async () => {
      answerPoints({
        total: 0,
        parts: { lessons: 0, quizzes: 0, courses: 0, streak: 0 },
        streakDays: 0,
      });
      await open();
      expect(cells()).toEqual(['Điểm thưởng', '0', 'Chuỗi 0 ngày']);
    });

    it('shows for a learner whose courses have no quiz', async () => {
      await open('giangvien', '000005');
      expect(cells()).toEqual(['Điểm thưởng', '40', 'Chuỗi 2 ngày']);
    });

    it('is hidden when the read fails, and nothing else is', async () => {
      fail(learnerEndpoints.myPoints);
      await open();
      expect(figure()).toBeNull();
      expect(text()).not.toContain('Điểm thưởng');
      expect(text()).not.toContain('Không tải được');
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);
      expect(cards().length).toBeGreaterThan(0);
    });

    it('does not wait for the summary', async () => {
      fail(learnerEndpoints.progressSummary);
      await open();
      expect(cells()).toEqual(['Điểm thưởng', '80', 'Chuỗi 2 ngày']);
    });
  });

  describe('a learner who has not taken a quiz yet', () => {
    it('sees dashes and "Chưa làm bài kiểm tra", and no "Đạt" verdict', async () => {
      await open('hocvien.tichhop', '000007');
      const cells = Array.from(
        el.querySelectorAll(
          'app-learn-kpis a:nth-of-type(n+2) dt, app-learn-kpis a:nth-of-type(n+2) dd',
        ),
      ).map((node) => node.textContent?.replace(/\s+/g, ' ').trim());
      expect(cells).toEqual([
        'Điểm kiểm tra gần nhất',
        '—',
        'Chưa làm bài kiểm tra',
        'Điểm cao nhất',
        '—',
        'Đạt 0/2 bài kiểm tra',
      ]);
      expect(el.querySelector('app-learn-kpis')!.textContent).not.toMatch(
        /Đạt ·/,
      );
    });
  });

  describe('a learner whose courses have no quiz', () => {
    it('sees dashes under both score figures and no error', async () => {
      await open('giangvien', '000005');
      const scores = Array.from(
        el.querySelectorAll('app-learn-kpis a:nth-of-type(n+2) dd'),
      ).map((node) => node.textContent?.replace(/\s+/g, ' ').trim());
      expect(scores).toEqual([
        '—',
        'Chưa có bài kiểm tra',
        '—',
        'Chưa có bài kiểm tra',
      ]);
      expect(text()).not.toContain('Không tải được');
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);
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
      const card = el.querySelector('app-continue-card')!;
      expect(card.textContent).toContain('Bạn chưa có khóa học đang học.');
      expect(card.querySelector('a')?.textContent).toContain(
        'Khám phá khóa học',
      );
      expect(card.querySelector('a')?.getAttribute('href')).toBe('/catalog');
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

  describe('the competency card', () => {
    const card = () =>
      el.querySelector<HTMLElement>(
        'section[aria-labelledby="learn-competency"]',
      )!;

    it('sits under "Khóa học của tôi", with a "Chi tiết" link to the progress page', async () => {
      await open();
      const heading = el.querySelector('#learn-competency')!;
      expect(heading.tagName).toBe('H2');
      expect(heading.textContent).toContain('Biểu đồ năng lực');
      const link = card().querySelector('a')!;
      expect(link.textContent?.trim()).toBe('Chi tiết');
      expect(link.getAttribute('href')).toBe('/progress');
      expect(card().querySelector('button')).toBeNull();
      expect(
        el.querySelector('#learn-courses')!.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('shows the radar when three competencies have data', async () => {
      await open();
      const view = card().querySelector('app-competency-view')!;
      expect(view.classList).toContain('competency-view--compact');
      expect(view.querySelector('ui-radar-chart')).not.toBeNull();
      expect(view.textContent).toContain(
        'Tỷ lệ đúng trên mọi lượt thi đã chấm',
      );
    });

    it('shows the inline empty state when no competency has data', async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((e, request) =>
        e === learnerQuizEndpoints.myCompetency
          ? { status: 200, body: envelopeOk([]) }
          : MockBackend.prototype.handle.call(backend, e, request),
      );
      await open();
      expect(card().textContent).toContain('Chưa có dữ liệu năng lực');
      expect(card().querySelector('ui-radar-chart')).toBeNull();
    });

    it('fails alone, with a retry, and leaves the rest of the page', async () => {
      fail(learnerQuizEndpoints.myCompetency);
      await open();
      expect(card().textContent).toContain('Không tải được biểu đồ năng lực');
      expect(card().querySelector('app-competency-view')).toBeNull();
      expect(el.querySelector('app-continue-card')).not.toBeNull();
      expect(el.querySelectorAll('app-learn-kpis dt')).toHaveLength(4);
      expect(cards().length).toBeGreaterThan(0);

      handle.mockRestore();
      handle = vi.spyOn(TestBed.inject(MockBackend), 'handle');
      Array.from(card().querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Thử lại'))!
        .click();
      await settle();
      expect(card().querySelector('ui-radar-chart')).not.toBeNull();
    });
  });

  describe('failed reads', () => {
    it('fail one section at a time, each with its own retry', async () => {
      fail(learnerEndpoints.progressSummary);
      await open();
      expect(section('Số liệu học tập').textContent).toContain(
        'Không tải được số liệu học tập',
      );
      expect(el.querySelector('app-continue-card')).not.toBeNull();
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
