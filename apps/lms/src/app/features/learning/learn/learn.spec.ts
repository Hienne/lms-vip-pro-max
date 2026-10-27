import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints } from '@lms/contracts';
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
      expect(text()).toContain('sẽ hiển thị khi hệ thống có dữ liệu');
      expect(text()).not.toContain('Điểm cao nhất');
    });

    it('lists the in-progress courses first and the status counts on the tabs', () => {
      expect(cards().length).toBeGreaterThan(0);
      expect(tab('Đang học').textContent).toMatch(/Đang học\s*\d+/);
      expect(tab('Bắt buộc').textContent?.trim()).toBe('Bắt buộc');
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
