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
        first.compareDocumentPosition(
          el.querySelector('app-progress-counts')!,
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(first.querySelector('a')?.textContent).toContain('Tiếp tục học');
      expect(first.querySelector('a')?.getAttribute('href')).toMatch(
        /^\/lesson\/\d+\/\d+(\?block=\d+)?$/,
      );
    });

    it('shows the server counts and the unavailable note', () => {
      expect(el.querySelectorAll('app-progress-counts dt')).toHaveLength(5);
      expect(text()).toContain('Giờ học sẽ hiển thị khi hệ thống có dữ liệu.');
      expect(text()).not.toContain('điểm kiểm tra sẽ hiển thị');
    });

    it('follows the counts with the last and the best score, each a link to the progress page', () => {
      const figures = Array.from(
        el.querySelectorAll<HTMLAnchorElement>('app-score-figures a'),
      );
      expect(figures.map((a) => a.getAttribute('href'))).toEqual([
        '/progress',
        '/progress',
      ]);
      expect(
        figures.map((a) =>
          Array.from(a.querySelectorAll('dt, dd')).map((node) =>
            node.textContent?.replace(/\s+/g, ' ').trim(),
          ),
        ),
      ).toEqual([
        [
          'Điểm kiểm tra gần nhất',
          '66,67%',
          'Chưa đạt · Luyện tập: Tổng quan hệ thống Core Banking',
        ],
        ['Điểm cao nhất', '90%', 'Đạt 1/5 bài kiểm tra'],
      ]);
      expect(
        el
          .querySelector('app-progress-counts')!
          .compareDocumentPosition(el.querySelector('app-score-figures')!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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

  describe('a learner who has not taken a quiz yet', () => {
    it('sees dashes and "Chưa làm bài kiểm tra"', async () => {
      await open('hocvien.tichhop', '000007');
      const cells = Array.from(
        el.querySelectorAll('app-score-figures dt, app-score-figures dd'),
      ).map((node) => node.textContent?.replace(/\s+/g, ' ').trim());
      expect(cells).toEqual([
        'Điểm kiểm tra gần nhất',
        '—',
        'Chưa làm bài kiểm tra',
        'Điểm cao nhất',
        '—',
        'Đạt 0/2 bài kiểm tra',
      ]);
    });
  });

  describe('a learner whose courses have no quiz', () => {
    it('sees no score figures and no error', async () => {
      await open('giangvien', '000005');
      expect(el.querySelector('app-score-figures dt')).toBeNull();
      expect(text()).not.toContain('Điểm kiểm tra gần nhất');
      expect(text()).not.toContain('Không tải được');
      expect(el.querySelectorAll('app-progress-counts dt')).toHaveLength(5);
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
      expect(el.querySelectorAll('app-progress-counts dt')).toHaveLength(5);
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
      expect(el.querySelectorAll('app-progress-counts dt')).toHaveLength(5);
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
