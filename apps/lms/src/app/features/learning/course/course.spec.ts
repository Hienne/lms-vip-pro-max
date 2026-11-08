import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  certificateEndpoints,
  courseEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
  type Certificate,
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
      expect(text()).toContain(
        'Chưa có thông tin đánh giá điều kiện hoàn thành.',
      );
      expect(text()).toMatch(/\d+\/\d+ bài bắt buộc đã hoàn thành/);
    });

    it('does not warn about a deadline that is still ahead', () => {
      expect(text()).not.toContain('Khóa học đã quá hạn');
    });

    it('reads the course once, and the detail once by the enrolment of the card, never the lists', () => {
      expect(calls(learnerEndpoints.course).length).toBe(1);
      expect(calls(learnerEndpoints.course)[0][1].params).toEqual({
        courseId: '1',
      });
      expect(calls(learnerEndpoints.enrollment).length).toBe(1);
      expect(calls(learnerEndpoints.myCourses).length).toBe(0);
      expect(calls(learnerEndpoints.catalog).length).toBe(0);
    });

    it('puts the programme in the breadcrumb and field · module first in the meta line', () => {
      expect(
        el.querySelector('ui-breadcrumb')?.textContent?.replace(/\s+/g, ' '),
      ).toContain(
        'Danh mục khóa học/Nền tảng nghiệp vụ Core Banking/Tổng quan hệ thống Core Banking',
      );
      expect(
        el.querySelector('ui-page-header')?.textContent?.replace(/\s+/g, ' '),
      ).toContain('Nghiệp vụ Core Banking · Tổng quan · NV-101');
    });
  });

  it('explains that the selected final exam must pass, without counting its outline link twice', async () => {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((endpoint, request) => {
      const reply = MockBackend.prototype.handle.call(
        backend,
        endpoint,
        request,
      );
      if (endpoint === learnerEndpoints.course && reply && 'body' in reply) {
        const data = reply.body.data as {
          content: {
            finalQuizId: number;
            chapters: {
              lessons: {
                lesson: {
                  lessonType: string;
                  quizId: number | null;
                  isRequired: boolean;
                };
              }[];
            }[];
          };
        };
        data.content.finalQuizId = 2;
        for (const chapter of data.content.chapters) {
          for (const { lesson } of chapter.lessons) {
            if (lesson.lessonType === 'quiz') {
              lesson.quizId = 2;
              lesson.isRequired = true;
            }
          }
        }
      }
      return reply;
    });
    await open(1);
    expect(text()).toContain('đạt điểm yêu cầu của 1 bài kiểm tra bắt buộc');
    expect(text()).toContain('62%');
  });

  it('keeps full learning progress separate from an unpassed completion condition', async () => {
    const backend = TestBed.inject(MockBackend);
    handle.mockImplementation((endpoint, request) => {
      const reply = MockBackend.prototype.handle.call(
        backend,
        endpoint,
        request,
      );
      if (reply && 'body' in reply) {
        if (endpoint === learnerEndpoints.course) {
          const data = reply.body.data as {
            card: { progressPercent: number; learningStatus: string };
          };
          data.card.progressPercent = 100;
          data.card.learningStatus = 'in_progress';
        }
        if (endpoint === learnerEndpoints.enrollment) {
          const data = reply.body.data as { completion?: unknown };
          data.completion = {
            completedRequiredLessons: 2,
            requiredLessons: 2,
            lessonsSatisfied: true,
            finalQuizId: 2,
            finalExamStatus: 'NOT_PASSED',
            allSatisfied: false,
          };
        }
      }
      return reply;
    });
    await open(1);
    expect(text()).toContain('100%');
    expect(text()).toContain('Chưa hoàn thành khóa');
    expect(text()).toContain('Bài bắt buộc: 2/2');
    expect(text()).toContain('Bài thi cuối khóa: Chưa đạt');
    expect(action('Đến bài thi cuối khóa')?.getAttribute('href')).toBe(
      '/quiz/2',
    );
    expect(
      el.querySelector('.course__actions .btn--primary')?.getAttribute('href'),
    ).toBe('/quiz/2');
  });

  describe('the cover image', () => {
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    });

    /** Course 1 with a cover, whose file the server answers (`readable`) or refuses. */
    async function openWithCover(readable: boolean) {
      URL.createObjectURL = vi.fn(() => 'blob:cover');
      URL.revokeObjectURL = vi.fn();
      const backend = TestBed.inject(MockBackend);
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
        const reply = MockBackend.prototype.handle.call(
          backend,
          endpoint,
          request,
        );
        if (
          endpoint !== learnerEndpoints.course ||
          !reply ||
          !('body' in reply)
        ) {
          return reply;
        }
        const data = reply.body.data as {
          content: { revision: Record<string, unknown> };
        };
        data.content.revision['coverAssetId'] = 77;
        return reply;
      });
      await open(1);
    }

    it('keeps the revision cover in the collapsible overview, read with no block', async () => {
      await openWithCover(true);
      const image = el.querySelector<HTMLImageElement>('.course__cover');
      expect(image?.getAttribute('src')).toBe('blob:cover');
      expect(image?.alt).toBe('');
      const overview =
        el.querySelector<HTMLDetailsElement>('.course__overview');
      expect(overview?.querySelector('img')).toBe(image);
      expect(overview?.open).toBe(false);
      expect(el.querySelector('.course__side .course__cover')).toBeNull();
      expect(calls(courseEndpoints.getAssetContent)[0][1].params).toEqual({
        assetId: '77',
      });
    });

    it('shows nothing while the server refuses the file, not even an empty box', async () => {
      await openWithCover(false);
      expect(el.querySelector('.course__cover')).toBeNull();
      expect(el.querySelector('.course__overview img')).toBeNull();
      expect(heading()).toBe('Tổng quan hệ thống Core Banking');
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

  describe('the certificate of a finished course', () => {
    /** The cycle `hocvien` has completed, read from the mock the way the list screen does. */
    function finished(): Certificate {
      const token = signInToMockBackend('hocvien');
      const reply = TestBed.inject(MockBackend).handle(
        certificateEndpoints.certificates,
        { token, params: {}, query: {}, body: undefined },
      );
      return (reply?.body as { data: { items: Certificate[] } }).data.items[0];
    }

    it('links to it as the one primary action, in place of resuming', async () => {
      const done = finished();
      await open(done.courseId);
      const link = action('Xem chứng nhận') as HTMLAnchorElement;
      expect(link).toBeTruthy();
      expect(link.getAttribute('href')).toBe(`/certificate/${done.id}`);
      expect(
        Array.from(el.querySelectorAll('.btn--primary')).map((b) =>
          b.textContent?.trim(),
        ),
      ).toEqual(['Xem chứng nhận']);
      expect(action('Tiếp tục học')).toBeUndefined();
      expect(action('Bắt đầu học')).toBeUndefined();
    });

    it('is offered nowhere on a course still in progress', async () => {
      await open(1);
      expect(text()).not.toContain('Xem chứng nhận');
      expect(action('Tiếp tục học')).toBeTruthy();
    });

    it('is offered nowhere on a course the learner has not joined', async () => {
      await open(7);
      expect(text()).not.toContain('Xem chứng nhận');
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

    it('reads the course once and shows the programme in the breadcrumb', () => {
      expect(calls(learnerEndpoints.course).length).toBe(1);
      expect(el.querySelector('ui-breadcrumb')?.textContent).toContain(
        'Danh mục khóa học',
      );
    });

    it('offers to enrol as the one primary action, without claiming the content is hidden', () => {
      expect(heading()).toBe('Phân hệ Thanh toán liên ngân hàng');
      expect(action('Đăng ký học')).toBeTruthy();
      expect(action('Tiếp tục học')).toBeUndefined();
      expect(
        Array.from(el.querySelectorAll('.btn--primary')).map((b) =>
          b.textContent?.trim(),
        ),
      ).toEqual(['Đăng ký học']);
      expect(text()).not.toContain('Đăng ký để xem nội dung');
      expect(calls(learnerEndpoints.enrollment).length).toBe(0);
    });

    it('shows the objectives and the chapters and lessons before enrolment, with no status, no link and no tally', () => {
      expect(text()).toContain('Mục tiêu đầu ra');
      expect(text()).toContain('Nội dung khóa học');
      const outline = el.querySelector('app-course-outline')!;
      expect(outline.querySelectorAll('details').length).toBeGreaterThan(0);
      const titles = Array.from(
        outline.querySelectorAll('.outline__title'),
      ).map((t) => t.textContent?.trim());
      expect(titles).toContain('Tổng kết');
      expect(outline.querySelectorAll('a')).toHaveLength(0);
      expect(outline.querySelectorAll('.outline__state')).toHaveLength(0);
      expect(text()).not.toContain('bài bắt buộc đã hoàn thành');
      expect(el.querySelector('[aria-labelledby="course-quizzes"]')).toBeNull();
      expect(calls(learnerEndpoints.course).length).toBe(1);
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
      expect(el.querySelectorAll('app-course-outline a')).toHaveLength(0);
    });
  });

  describe('a course whose names the server left out', () => {
    it('drops the programme from the breadcrumb and the field and module from the meta line, never a dash', async () => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((endpoint, request) => {
        const reply = MockBackend.prototype.handle.call(
          backend,
          endpoint,
          request,
        ) as { body: { data: { card: Record<string, unknown> } } };
        if (endpoint === learnerEndpoints.course) {
          Object.assign(reply.body.data.card, {
            fieldId: null,
            fieldName: null,
            programName: null,
            moduleName: null,
          });
        }
        return reply as never;
      });
      await open(1);
      expect(
        el.querySelector('ui-breadcrumb')?.textContent?.replace(/\s+/g, ' '),
      ).toBe('Danh mục khóa học/Tổng quan hệ thống Core Banking');
      const meta = el
        .querySelector('ui-page-header')
        ?.textContent?.replace(/\s+/g, ' ');
      expect(meta).toContain('NV-101');
      expect(meta).not.toContain('—');
      expect(meta).not.toContain('Nghiệp vụ Core Banking ·');
    });
  });

  describe('the rating of the course', () => {
    const rated = (rating: unknown) => {
      const backend = TestBed.inject(MockBackend);
      handle.mockImplementation((endpoint, request) => {
        const reply = MockBackend.prototype.handle.call(
          backend,
          endpoint,
          request,
        ) as { body: { data: { card: Record<string, unknown> } } };
        if (endpoint === learnerEndpoints.course) {
          Object.assign(reply.body.data.card, { rating });
        }
        return reply as never;
      });
    };
    const meta = () => el.querySelector<HTMLElement>('.course__meta')!;

    it('shows ★, the average and how many rated on the meta line', async () => {
      await open(1);
      expect(meta().querySelector('[aria-hidden="true"]')?.textContent).toBe(
        '★ 4,5 (2)',
      );
      expect(meta().textContent).toContain('Đánh giá 4,5 trên 5 sao từ 2 lượt');
    });

    it('keeps one decimal, with the Vietnamese comma, for a whole average', async () => {
      rated({ average: 4, count: 12 });
      await open(1);
      expect(meta().textContent).toContain('★ 4,0 (12)');
    });

    it('shows nothing when nobody has rated the course', async () => {
      rated(null);
      await open(1);
      expect(meta().textContent).not.toContain('★');
      expect(meta().textContent).not.toContain('Đánh giá');
    });

    it('shows nothing when the server leaves the rating out', async () => {
      await open(3);
      expect(meta().textContent).not.toContain('★');
      expect(meta().textContent).not.toContain('Đánh giá');
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
        endpoint === learnerEndpoints.course
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
