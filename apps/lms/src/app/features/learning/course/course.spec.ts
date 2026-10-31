import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { learnerEndpoints, learnerQuizEndpoints } from '@lms/contracts';
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

describe('Course', () => {
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
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    TestBed.tick();
  }

  /** Opens a course as `hocvien` (000004): course 1 is in progress, 4 is overdue, 7 not joined. */
  async function open(courseId: number | string) {
    signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/course/${courseId}`);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const heading = () => el.querySelector('h1')?.textContent?.trim();
  const action = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((node) =>
      node.textContent?.includes(label),
    );
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  describe('an enrolled course', () => {
    beforeEach(() => open(1));

    it('shows the title, the breadcrumb back to the catalogue and the server progress', () => {
      expect(heading()).toBe('Tổng quan hệ thống Core Banking');
      const crumbs = el.querySelector('ui-breadcrumb')!;
      expect(crumbs.textContent).toContain('Danh mục khóa học');
      expect(crumbs.querySelector('a')?.getAttribute('href')).toBe('/catalog');
      expect(text()).toContain('62%');
    });

    it('offers one primary action that resumes at the lesson the server remembers', () => {
      const resume = action('Tiếp tục học') as HTMLAnchorElement;
      expect(resume).toBeTruthy();
      expect(resume.getAttribute('href')).toMatch(/^\/lesson\/1\/\d+$/);
      expect(action('Đăng ký học')).toBeUndefined();
      // The quiz cards below are secondary: the resume button stays the only primary.
      expect(
        el.querySelector('[aria-labelledby="course-quizzes"]'),
      ).not.toBeNull();
      expect(
        Array.from(el.querySelectorAll('.btn--primary')).map((b) =>
          b.textContent?.trim(),
        ),
      ).toEqual(['Tiếp tục học']);
    });

    it('lists the chapters with a link to every lesson, the quiz lesson marked with its own icon', () => {
      const chapters = el.querySelectorAll('app-course-outline details');
      expect(chapters.length).toBe(2);
      expect(
        Array.from(el.querySelectorAll('app-course-outline a')).every((a) =>
          /^\/lesson\/1\/\d+$/.test(a.getAttribute('href') ?? ''),
        ),
      ).toBe(true);
      const quiz = Array.from(
        el.querySelectorAll('app-course-outline li'),
      ).find((li) => li.textContent?.includes('Kiểm tra cuối khóa'));
      expect(quiz?.querySelector('a')?.getAttribute('href')).toMatch(
        /^\/lesson\/1\/\d+$/,
      );
      expect(quiz?.querySelector('ui-icon')).not.toBeNull();
      expect(quiz?.textContent).not.toContain('chưa mở');
    });

    it('features the final exam in a card and lists the other quizzes as rows', () => {
      const section = el.querySelector('[aria-labelledby="course-quizzes"]')!;
      expect(section.querySelector('h2')?.textContent).toBe('Bài kiểm tra');
      const exam = section.querySelector('.course__final')!;
      expect(exam.textContent).toContain('Thi cuối khóa');
      expect(exam.textContent).toContain('Điểm đạt ≥ 70%');
      expect(exam.textContent).toContain('Còn 2 lượt');
      const start = Array.from(exam.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Làm bài',
      );
      expect(start?.getAttribute('href')).toBe('/quiz/2');
      const rows = section.querySelectorAll('.course__quizzes li');
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain('Luyện tập');
      expect(calls(learnerQuizEndpoints.courseQuizzes).length).toBe(1);
    });

    it('marks the lessons the server reports done and the one in progress', () => {
      const states = Array.from(
        el.querySelectorAll('app-course-outline [data-status]'),
      ).map((node) => node.getAttribute('data-status'));
      expect(states).toContain('completed');
      expect(states).toContain('in_progress');
    });

    it('states the completion condition and the lessons done out of the required ones', () => {
      expect(text()).toContain('Mục tiêu đầu ra');
      expect(text()).toContain('Học đủ');
      expect(text()).toMatch(/\d+\/\d+ bài bắt buộc đã hoàn thành/);
    });

    it('does not warn about a deadline that is still ahead', () => {
      expect(el.querySelector('ui-alert')).toBeNull();
    });

    it('reads the card from the lists and the detail once, by the enrolment of the card', () => {
      expect(calls(learnerEndpoints.enrollment).length).toBe(1);
    });
  });

  describe('a course whose quizzes do not load', () => {
    it('keeps the course and offers a retry for the quiz section only', async () => {
      const backend = TestBed.inject(MockBackend);
      const original: MockBackend['handle'] = (endpoint, request) =>
        MockBackend.prototype.handle.call(backend, endpoint, request);
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerQuizEndpoints.courseQuizzes
          ? backendRefusal('internalError')
          : original(endpoint, request),
      );
      await open(1);
      expect(heading()).toBe('Tổng quan hệ thống Core Banking');
      expect(text()).toContain('Không tải được bài kiểm tra');
      expect(el.querySelector('app-course-outline')).not.toBeNull();

      handle.mockImplementation(original);
      action('Thử lại')!.click();
      await settle();
      expect(el.querySelector('.course__final')?.textContent).toContain(
        'Thi cuối khóa',
      );
    });
  });

  describe('a course without quizzes', () => {
    it('shows no quiz section', async () => {
      await open(4);
      expect(el.querySelector('[aria-labelledby="course-quizzes"]')).toBeNull();
    });
  });

  describe('an overdue course', () => {
    it('shows the danger alert and the overdue deadline', async () => {
      await open(4);
      const alert = el.querySelector('ui-alert')!;
      expect(alert.textContent).toContain('Khóa học đã quá hạn');
      expect(text()).toContain('Quá hạn');
    });
  });

  describe('an optional course the learner has not joined', () => {
    beforeEach(() => open(7));

    it('offers to enrol and does not show an outline before it', () => {
      expect(heading()).toBe('Phân hệ Thanh toán liên ngân hàng');
      expect(action('Đăng ký học')).toBeTruthy();
      expect(action('Tiếp tục học')).toBeUndefined();
      expect(el.querySelector('app-course-outline')).toBeNull();
      expect(text()).toContain('Đăng ký để xem nội dung và bắt đầu học.');
      expect(calls(learnerEndpoints.enrollment).length).toBe(0);
    });

    it('enrols, then shows the outline and the start action without leaving the page', async () => {
      action('Đăng ký học')!.click();
      await settle();
      expect(calls(learnerEndpoints.enroll).length).toBe(1);
      expect(action('Đăng ký học')).toBeUndefined();
      const start = action('Bắt đầu học') as HTMLAnchorElement;
      expect(start.getAttribute('href')).toMatch(/^\/lesson\/7\/\d+$/);
      expect(el.querySelectorAll('app-course-outline details').length).toBe(1);
      expect(document.body.textContent?.replace(/\s+/g, ' ')).toContain(
        'Đã đăng ký khóa học',
      );
    });

    it('keeps the page and the button when the server refuses', async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.enroll
          ? backendRefusal('notAvailable')
          : MockBackend.prototype.handle.call(backend, endpoint, request),
      );
      action('Đăng ký học')!.click();
      await settle();
      expect(action('Đăng ký học')).toBeTruthy();
      expect(el.querySelector('app-course-outline')).toBeNull();
    });
  });

  describe('a mandatory course nobody assigned', () => {
    it('explains that it must be assigned and shows no button', async () => {
      await open(3);
      expect(text()).toContain('Khóa học bắt buộc này cần được giao để học.');
      expect(action('Đăng ký học')).toBeUndefined();
      expect(action('Bắt đầu học')).toBeUndefined();
    });
  });

  describe('a failed read', () => {
    it('shows the error with a retry that loads the page once the server answers', async () => {
      const backend = TestBed.inject(MockBackend);
      const original: MockBackend['handle'] = (endpoint, request) =>
        MockBackend.prototype.handle.call(backend, endpoint, request);
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.myCourses
          ? backendRefusal('internalError')
          : original(endpoint, request),
      );
      await open(1);
      expect(text()).toContain('Không tải được khóa học');
      expect(heading()).not.toBe('Tổng quan hệ thống Core Banking');

      handle.mockImplementation(original);
      action('Thử lại')!.click();
      await settle();
      expect(heading()).toBe('Tổng quan hệ thống Core Banking');
    });
  });

  describe('a course that is not there', () => {
    it.each([6, 999, 'abc'])(
      'says so and leads back to the catalogue (%s)',
      async (id) => {
        await open(id);
        expect(heading()).toBe('Không tìm thấy khóa học');
        expect(action('Về danh mục')?.getAttribute('href')).toBe('/catalog');
      },
    );
  });
});
