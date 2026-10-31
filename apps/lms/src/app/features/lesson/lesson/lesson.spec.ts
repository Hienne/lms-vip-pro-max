import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  courseEndpoints,
  EnrollmentDetailSchema,
  learnerEndpoints,
  learnerQuizEndpoints,
  type EnrollmentDetail,
} from '@lms/contracts';
import { backendRefusal, envelopeOk, type FakeReply } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import { createAppRoutes } from '../../../app.routes';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import { FileSaver } from '../../../core/files/file-saver';
import { MockBackend } from '../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { PdfEngine, type PdfFile } from './components/pdf-block/pdf-engine';
import { SessionStore } from '../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../core/session/session.testing';

const COURSE = 7;

/** jsdom has no canvas, so the page spec draws PDFs with a stub. */
class StubPdfEngine {
  readonly opened: string[] = [];
  open(url: string): Promise<PdfFile> {
    this.opened.push(url);
    return Promise.resolve({
      pageCount: 4,
      render: () => ({ done: Promise.resolve(), cancel: () => undefined }),
      destroy: () => undefined,
    });
  }
}

describe('Lesson', () => {
  let pdf: StubPdfEngine;
  let backend: MockBackend;
  let handle: MockInstance<MockBackend['handle']>;
  let token: string;
  let detail: EnrollmentDetail;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  const real = (): MockBackend['handle'] => (endpoint, request) =>
    MockBackend.prototype.handle.call(backend, endpoint, request);

  const call = (
    endpoint: Parameters<MockBackend['handle']>[0],
    params: Record<string, string> = {},
    body?: unknown,
  ) => real()(endpoint, { token, params, query: { size: '100' }, body });

  beforeEach(() => {
    sessionStorage.clear();
    pdf = new StubPdfEngine();
    TestBed.configureTestingModule({
      providers: [
        { provide: PdfEngine, useValue: pdf },
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter(createAppRoutes({ devTools: true })),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    backend = TestBed.inject(MockBackend);
    token = signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    const enrolled = call(learnerEndpoints.enroll, {
      courseId: String(COURSE),
    });
    detail = EnrollmentDetailSchema.parse(
      (
        call(learnerEndpoints.enrollment, {
          enrollmentId: String(
            (enrolled?.body as { data: { id: number } }).data.id,
          ),
        })?.body as { data: unknown }
      ).data,
    );
    handle = vi.spyOn(backend, 'handle');
  });

  const lessons = () => detail.content.chapters.flatMap((c) => c.lessons);

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    TestBed.tick();
  }

  async function open(url: string) {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  const lessonUrl = (index: number, query = '') =>
    `/lesson/${COURSE}/${lessons()[index].lesson.id}${query}`;
  const text = () => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('button, a')).find((node) =>
      node.textContent?.includes(label),
    );
  const calls = (endpoint: unknown) =>
    handle.mock.calls.filter(([e]) => e === endpoint);

  describe('a text lesson', () => {
    beforeEach(() => open(lessonUrl(2)));

    it('shows the title, where it sits in the course and the way out', () => {
      expect(el.querySelector('h1')?.textContent).toBe('Tổng kết');
      expect(text()).toContain('Bài 3/3');
      expect(text()).toContain('5 phút');
      const exit = button('Thoát') as HTMLAnchorElement;
      expect(exit.getAttribute('href')).toBe(`/course/${COURSE}`);
      expect(text()).toContain('Phân hệ Thanh toán liên ngân hàng');
      expect(text()).toContain('Thanh toán và đối soát');
    });

    it('renders the text of the block and, with one block only, no block list', () => {
      expect(el.querySelector('app-text-block')).not.toBeNull();
      expect(el.querySelector('app-block-list')).toBeNull();
    });

    it('saves the open, and says so once the server accepted it', () => {
      expect(calls(learnerEndpoints.saveProgress).length).toBe(1);
      expect(el.querySelector('[aria-live="polite"]')?.textContent).toContain(
        'Đã lưu tiến độ',
      );
    });

    it('completes on "Đánh dấu hoàn thành" and shows the server result in the outline and the course percentage', async () => {
      const before = text();
      expect(before).not.toContain('Đã hoàn thành');
      button('Đánh dấu hoàn thành')!.click();
      await settle();

      expect(button('Đánh dấu hoàn thành')).toBeUndefined();
      expect(text()).toContain('Đã hoàn thành');
      const outlineStates = Array.from(
        el.querySelectorAll('app-lesson-outline .toc__sr'),
      ).map((s) => s.textContent?.trim());
      expect(outlineStates.at(-1)).toBe('Đã hoàn thành');
      expect(text()).toMatch(/Khóa học\s+\d+%/);
    });

    it('offers the previous lesson and no next one at the last lesson', () => {
      const previous = button('Bài trước') as HTMLAnchorElement;
      expect(previous.getAttribute('href')).toBe(
        `/lesson/${COURSE}/${lessons()[1].lesson.id}`,
      );
      expect(button('Bài tiếp theo')).toBeUndefined();
    });
  });

  describe('a video lesson', () => {
    beforeEach(() => open(lessonUrl(0)));

    const player = () => el.querySelector('video');
    const sent = () =>
      calls(learnerEndpoints.saveProgress).map(
        ([, r]) =>
          r.body as {
            eventType: string;
            playing: boolean;
            watchedFromSeconds?: number;
            watchedToSeconds?: number;
          },
      );

    it('loads the content URL of the block only once this tab holds the session, without autoplay', () => {
      expect(player()?.getAttribute('src')).toMatch(
        /^\/api\/v1\/learning-assets\/\d+\/content\?blockId=\d+&enrollmentId=\d+$/,
      );
      expect(player()?.autoplay).toBe(false);
      expect(text()).toMatch(/Đã xem \d+% · cần \d+%/);
    });

    it('sends PLAY when the learner plays and PAUSE when they pause', async () => {
      handle.mockClear();
      player()!.dispatchEvent(new Event('play'));
      player()!.dispatchEvent(new Event('pause'));
      await settle();
      expect(sent().map((e) => e.eventType)).toEqual(['PLAY', 'PAUSE']);
      expect(sent()[0].playing).toBe(true);
      expect(sent()[1].playing).toBe(false);
    });

    it('closes the block with the range played when the learner leaves the page', async () => {
      let now = 0;
      Object.defineProperty(player(), 'currentTime', {
        get: () => now,
        set: (value: number) => (now = value),
      });
      player()!.dispatchEvent(new Event('play'));
      await settle();
      now = 7;
      handle.mockClear();

      await harness.navigateByUrl('/catalog');
      await settle();

      expect(sent().find((e) => e.eventType === 'CLOSE')).toMatchObject({
        watchedFromSeconds: 0,
        watchedToSeconds: 7,
      });
    });

    it('shows "Không phát được video." and claims the block again on "Thử lại"', async () => {
      player()!.dispatchEvent(new Event('error'));
      await settle();
      expect(text()).toContain('Không phát được video.');
      handle.mockClear();
      button('Thử lại')!.click();
      await settle();
      expect(calls(learnerEndpoints.openSession).length).toBe(1);
      expect(player()).not.toBeNull();
    });
  });

  describe('a lesson with several blocks', () => {
    beforeEach(() => open(lessonUrl(1)));

    const choose = async (title: string) => {
      Array.from(el.querySelectorAll<HTMLElement>('app-block-list button'))
        .find((b) => b.textContent?.includes(title))!
        .click();
      await settle();
    };

    it('lists the blocks and starts on the first', () => {
      const items = Array.from(el.querySelectorAll('app-block-list button'));
      expect(items.length).toBe(4);
      expect(items[0].getAttribute('aria-current')).toBe('true');
    });

    it('shows the picture of an image block with the content URL and the usage alt text', async () => {
      await choose('Mẫu báo cáo đối soát');
      const img = el.querySelector('app-image-block img');
      expect(img?.getAttribute('src')).toMatch(
        /^\/api\/v1\/learning-assets\/\d+\/content\?blockId=\d+&enrollmentId=\d+$/,
      );
      expect(img?.getAttribute('alt')).toBeTruthy();
    });

    it('lists an attachment and saves it under its name through the content endpoint', async () => {
      const saved: [Blob, string][] = [];
      vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation(
        (blob, name) => void saved.push([blob, name]),
      );
      const original = real();
      handle.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.getAssetContent
          ? // The mock has no file bytes: a real response of this endpoint is a blob, not an envelope.
            {
              status: 200,
              body: new Blob(['x']) as unknown as FakeReply['body'],
            }
          : original(endpoint, request),
      );
      await choose('Biểu mẫu đối soát');
      const download = el.querySelector<HTMLButtonElement>(
        'app-attachment-block button',
      )!;
      download.click();
      await settle();
      expect(calls(courseEndpoints.getAssetContent).length).toBe(1);
      expect(saved.length).toBe(1);
      expect(saved[0][1]).toBe(
        el.querySelector('app-attachment-block .files__name')?.textContent,
      );
    });

    it('keeps the page and shows no file when the server refuses the download', async () => {
      const saver = vi.spyOn(TestBed.inject(FileSaver), 'save');
      const original = real();
      handle.mockImplementation((endpoint, request) =>
        endpoint === courseEndpoints.getAssetContent
          ? backendRefusal('notAvailable')
          : original(endpoint, request),
      );
      await choose('Biểu mẫu đối soát');
      el.querySelector<HTMLButtonElement>(
        'app-attachment-block button',
      )!.click();
      await settle();
      expect(saver).not.toHaveBeenCalled();
      expect(el.querySelector('app-attachment-block')).not.toBeNull();
    });

    it('opens the PDF block on the content URL of its file', () => {
      expect(el.querySelector('app-pdf-block')).not.toBeNull();
      expect(pdf.opened[0]).toMatch(
        /^\/api\/v1\/learning-assets\/\d+\/content\?blockId=\d+&enrollmentId=\d+$/,
      );
      expect(text()).toContain('Trang 1/4');
    });

    it('moves to a block, keeps it in the URL and closes the old one on the server', async () => {
      const process = Array.from(
        el.querySelectorAll<HTMLElement>('app-block-list button'),
      ).find((b) => b.textContent?.includes('Các bước đối soát'))!;
      handle.mockClear();
      process.click();
      await settle();

      expect(el.querySelector('app-process-block')).not.toBeNull();
      expect(process.getAttribute('aria-current')).toBe('true');
      expect(TestBed.inject(Router).url).toMatch(/block=\d+/);
      expect(
        calls(learnerEndpoints.saveProgress).map(
          ([, r]) => (r.body as { eventType: string }).eventType,
        ),
      ).toEqual(['CLOSE', 'OPEN']);
    });

    it('goes through the blocks with "Khối tiếp theo" and "Khối trước", then on to the next lesson', async () => {
      expect(button('Khối trước')).toBeUndefined();
      for (let i = 0; i < 3; i++) {
        button('Khối tiếp theo')!.click();
        await settle();
      }
      expect(button('Khối tiếp theo')).toBeUndefined();
      expect(button('Khối trước')).toBeTruthy();
      expect(
        (button('Bài tiếp theo') as HTMLAnchorElement).getAttribute('href'),
      ).toBe(`/lesson/${COURSE}/${lessons()[2].lesson.id}`);
    });
  });

  describe('the session', () => {
    it('asks before taking the lesson over from another device and studies after the click', async () => {
      const block = lessons()[2].blocks[0].block.id;
      call(
        learnerEndpoints.openSession,
        {},
        {
          enrollmentId: detail.enrollment.id,
          blockId: block,
          takeover: true,
        },
      );
      await open(lessonUrl(2));

      expect(text()).toContain('Bài học đang mở ở nơi khác');
      expect(calls(learnerEndpoints.saveProgress).length).toBe(0);

      button('Học trên thiết bị này')!.click();
      await settle();

      expect(text()).not.toContain('Bài học đang mở ở nơi khác');
      expect(calls(learnerEndpoints.saveProgress).length).toBe(1);
    });

    it('says the progress could not be saved and offers to try again', async () => {
      await open(lessonUrl(2));
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.saveProgress
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      button('Đánh dấu hoàn thành')!.click();
      await settle();
      expect(text()).toContain('Chưa lưu được tiến độ');

      handle.mockImplementation(real());
      button('Thử lại')!.click();
      await settle();
      expect(text()).toContain('Đã lưu tiến độ');
      expect(text()).toContain('Đã hoàn thành');
    });
  });

  describe('what is not a lesson to study', () => {
    const quizLesson = () => {
      const mine = call(learnerEndpoints.myCourses);
      const card = (
        mine?.body as {
          data: { items: { courseId: number; enrollmentId: number }[] };
        }
      ).data.items.find((c) => c.courseId === 1)!;
      const course = EnrollmentDetailSchema.parse(
        (
          call(learnerEndpoints.enrollment, {
            enrollmentId: String(card.enrollmentId),
          })?.body as { data: unknown }
        ).data,
      );
      return course.content.chapters
        .flatMap((c) => c.lessons)
        .find((l) => l.lesson.lessonType === 'quiz')!;
    };

    it('shows the quiz a quiz lesson holds, with the way in, and opens no study session', async () => {
      const quiz = quizLesson();
      await open(`/lesson/1/${quiz.lesson.id}`);

      expect(el.querySelector('h1')?.textContent).toBe(quiz.lesson.title);
      const card = el.querySelector('app-quiz-card')!;
      expect(card.textContent).toContain('Thi cuối khóa');
      expect(card.textContent).toContain('Điểm đạt ≥ 70%');
      expect(
        Array.from(card.querySelectorAll('a'))
          .find((a) => a.textContent?.trim() === 'Làm bài')
          ?.getAttribute('href'),
      ).toBe('/quiz/2');
      const primary = Array.from(el.querySelectorAll('.btn--primary'));
      expect(primary.map((b) => b.textContent?.trim())).toEqual(['Làm bài']);
      expect(
        button('Bài tiếp theo')?.classList.contains('btn--primary'),
      ).not.toBe(true);
      expect(button('Mục lục')).toBeTruthy();
      expect(calls(learnerEndpoints.openSession).length).toBe(0);
      expect(calls(learnerQuizEndpoints.courseQuizzes).length).toBe(1);
    });

    it('lets the learner move on to the lessons around a quiz lesson', async () => {
      await open(`/lesson/1/${quizLesson().lesson.id}`);
      expect(button('Bài trước')?.getAttribute('href')).toMatch(
        /^\/lesson\/1\/\d+$/,
      );
    });

    it('says so when no quiz is linked to the lesson', async () => {
      const quiz = quizLesson();
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerQuizEndpoints.courseQuizzes
          ? { status: 200, body: envelopeOk([]) }
          : real()(endpoint, request),
      );
      await open(`/lesson/1/${quiz.lesson.id}`);
      expect(el.querySelector('app-quiz-card')).toBeNull();
      expect(text()).toContain('chưa được gắn vào bài học này');
    });

    it('shows the error with a retry when the quizzes cannot be read', async () => {
      const quiz = quizLesson();
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerQuizEndpoints.courseQuizzes
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await open(`/lesson/1/${quiz.lesson.id}`);
      expect(text()).toContain('Không tải được bài kiểm tra');

      handle.mockImplementation(real());
      button('Thử lại')!.click();
      await settle();
      expect(el.querySelector('app-quiz-card')).not.toBeNull();
    });

    it('sends a learner who has not enrolled to the course page', async () => {
      await open('/lesson/3/1');
      expect(text()).toContain('Bạn chưa đăng ký khóa học này.');
      expect(button('Về khóa học')?.getAttribute('href')).toBe('/course/3');
    });

    it('says an unknown lesson is not found', async () => {
      await open(`/lesson/${COURSE}/999999`);
      expect(el.querySelector('h1')?.textContent).toBe(
        'Không tìm thấy bài học',
      );
      expect(button('Về khóa học')?.getAttribute('href')).toBe(
        `/course/${COURSE}`,
      );
    });

    it('shows the error with a retry when the course cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === learnerEndpoints.myCourses
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await open(lessonUrl(2));
      expect(text()).toContain('Không tải được bài học');

      handle.mockImplementation(real());
      button('Thử lại')!.click();
      await settle();
      expect(el.querySelector('h1')?.textContent).toBe('Tổng kết');
    });
  });
});
