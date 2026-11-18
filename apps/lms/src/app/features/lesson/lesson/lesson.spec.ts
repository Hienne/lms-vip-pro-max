import { AgentChatStore } from '../../../core/assistant/agent-chat.store';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  courseEndpoints,
  EnrollmentDetailSchema,
  feedbackEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
  personalEndpoints,
  scormEndpoints,
  type EnrollmentDetail,
  type LearnerCourse,
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
  ReplyGate,
  signInToMockBackend,
} from '../../../core/dev/mock-api/mock-backend.testing';
import { PdfEngine, type PdfFile } from './components/pdf-block/pdf-engine';
import { LESSON_FOCUS_KEY } from './data-access/lesson-focus';
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
      pageRatios: [1.5, 1.5, 1.5, 1.5],
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

  async function scrollPdf(page: number): Promise<void> {
    const stage = el.querySelector<HTMLElement>('.pdf__stage')!;
    Object.defineProperties(stage, {
      clientHeight: { value: 600, configurable: true },
      scrollHeight: { value: 4000, configurable: true },
    });
    el.querySelectorAll('.pdf__page').forEach((sheet, index) => {
      Object.defineProperties(sheet, {
        offsetTop: { value: index * 1000, configurable: true },
        offsetHeight: { value: 1000, configurable: true },
      });
    });
    stage.scrollTop = (page - 1) * 1000 + 1;
    stage.dispatchEvent(new Event('scroll'));
    await settle();
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

  it.each([
    { rule: 'completed_or_passed', restartStatus: 'failed' },
    { rule: 'passed', restartStatus: 'completed' },
  ] as const)(
    'embeds SCORM with $rule, refreshes without relaunching and restarts $restartStatus',
    async ({ rule, restartStatus }) => {
      const lesson = lessons()[2];
      lesson.lesson.lessonType = 'scorm';
      lesson.lesson.scormPackageId = 42;
      lesson.lesson.scormCompletionRule = rule;
      lesson.blocks = [];
      let score: number | null = null;
      let failed = false;
      let restarted = false;
      const progress = () => ({
        lessonStatus: restarted
          ? 'not attempted'
          : failed
            ? restartStatus
            : score === null
              ? 'incomplete'
              : 'passed',
        scoreRaw: score,
        scoreMin: 0,
        scoreMax: 100,
        lessonLocation: 'page-4',
        resumable: true,
        updateTime: '2026-11-13T10:00:00Z',
      });
      const launchUrl =
        'https://scorm.example.test/scorm-player/' + 'a'.repeat(43) + '/launch';
      handle.mockImplementation((endpoint, request) => {
        if (endpoint === learnerEndpoints.course) {
          const reply = real()(endpoint, request);
          const data = (reply?.body as { data: LearnerCourse }).data;
          return {
            status: 200,
            body: envelopeOk({ ...data, content: detail.content }),
          };
        }
        if (endpoint === learnerEndpoints.enrollment)
          return { status: 200, body: envelopeOk(detail) };
        if (endpoint === scormEndpoints.progress)
          return { status: 200, body: envelopeOk(progress()) };
        if (endpoint === scormEndpoints.launch) {
          if ((request.body as { restart?: boolean }).restart) {
            restarted = true;
            failed = false;
            score = null;
          }
          return {
            status: 200,
            body: envelopeOk({
              launchUrl,
              preview: false,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              progress: progress(),
            }),
          };
        }
        return real()(endpoint, request);
      });
      await open(lessonUrl(2));
      const iframe = el.querySelector<HTMLIFrameElement>(
        'iframe[title="Nội dung bài giảng SCORM"]',
      );
      if (!iframe) throw new Error('Embedded SCORM iframe missing: ' + text());
      expect(iframe.getAttribute('src')).toBe(launchUrl);
      expect(el.querySelector('app-lesson-outline')).not.toBeNull();
      expect(el.querySelector('a[href^="/scorm/"]')).toBeNull();
      expect(calls(scormEndpoints.launch)).toHaveLength(1);
      expect(calls(scormEndpoints.launch)[0][1].body).toMatchObject({
        preview: false,
        lessonId: lesson.lesson.id,
        enrollmentId: detail.enrollment.id,
      });
      const before = calls(scormEndpoints.progress).length;
      const notify = (origin: string) =>
        window.dispatchEvent(
          new MessageEvent('message', {
            origin,
            source: iframe.contentWindow,
            data: {
              type: 'scorm:state',
              state: 'saved',
              progress: { scoreRaw: 999 },
            },
          }),
        );
      notify('https://untrusted.example.test');
      await settle();
      expect(calls(scormEndpoints.progress)).toHaveLength(before);
      score = 85;
      notify('https://scorm.example.test');
      await settle();
      expect(text()).toContain('Điểm 85');
      expect(text()).not.toContain('999');
      expect(calls(scormEndpoints.launch)).toHaveLength(1);
      expect(el.querySelector('iframe[title="Nội dung bài giảng SCORM"]')).toBe(
        iframe,
      );
      await settle();
      expect(calls(scormEndpoints.launch)).toHaveLength(1);
      failed = true;
      score = 73;
      notify('https://scorm.example.test');
      await settle();
      button('Học lại')!.click();
      await settle();
      const dialog = document.querySelector('[role="alertdialog"]')!;
      Array.from(dialog.querySelectorAll('button'))
        .find((node) => node.textContent?.includes('Học lại'))!
        .click();
      await settle();
      expect(calls(scormEndpoints.launch)).toHaveLength(2);
      expect(calls(scormEndpoints.launch)[1][1].body).toMatchObject({
        restart: true,
        preview: false,
        enrollmentId: detail.enrollment.id,
        lessonId: lesson.lesson.id,
      });
      expect(el.querySelector('app-lesson-outline')).not.toBeNull();
      expect(text()).not.toContain('Điểm 73');
    },
  );

  describe('a text lesson', () => {
    beforeEach(() => open(lessonUrl(2)));

    it('names the course in the bar, the chapter beside it from md, and the position under the title only', () => {
      const where = el.querySelector('.lesson__where');
      expect(where?.textContent).toContain('Phân hệ Thanh toán liên ngân hàng');
      expect(
        where?.querySelector('.lesson__where-chapter')?.textContent,
      ).toContain('Thanh toán và đối soát');
      expect(el.querySelector('.lesson__bar')?.textContent).not.toContain(
        'Bài 3/3',
      );
      expect(el.querySelector('ui-page-header')?.textContent).toContain(
        'Bài 3/3',
      );
    });

    it('offers one way out per width: an icon with its name on a phone, a labelled button from md', () => {
      const exits = Array.from(
        el.querySelectorAll<HTMLAnchorElement>('.lesson__exit'),
      );
      expect(exits.map((a) => a.getAttribute('href'))).toEqual([
        `/course/${COURSE}`,
        `/course/${COURSE}`,
      ]);
      expect(
        el.querySelector('.lesson__exit--compact')?.getAttribute('aria-label'),
      ).toBe('Thoát');
      expect(el.querySelector('.lesson__exit--full')?.textContent).toContain(
        'Thoát',
      );
    });

    it('offers to ask the assistant about this lesson or to summarise it from one menu, naming the lesson to the store', async () => {
      const ask = vi
        .spyOn(TestBed.inject(AgentChatStore), 'askAboutLesson')
        .mockImplementation(() => undefined);
      const lesson = {
        courseId: COURSE,
        revisionId: detail.content.revision.id,
        lessonId: lessons()[2].lesson.id,
        label: expect.stringContaining('Tổng kết') as unknown as string,
      };
      const choose = async (label: string) => {
        el.querySelector<HTMLButtonElement>(
          '.lesson__assist--full button',
        )!.click();
        await settle();
        Array.from(
          document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        )
          .find((item) => item.textContent?.includes(label))!
          .click();
        await settle();
      };

      expect(button('Hỏi về bài này')).toBeUndefined();
      await choose('Hỏi về bài này');
      await choose('Tóm tắt bài này');

      expect(ask).toHaveBeenNthCalledWith(1, lesson, 'Bài này nói gì?');
      expect(ask).toHaveBeenNthCalledWith(
        2,
        lesson,
        'Tóm tắt bài này',
        'tom_tat_bai',
      );
    });

    it('shows the title, where it sits in the course and the way out', () => {
      expect(el.querySelector('h1')?.textContent).toBe('Tổng kết');
      expect(text()).toContain('Bài 3/3');
      expect(text()).toContain('5 phút');
      const exit = button('Thoát') as HTMLAnchorElement;
      expect(exit.getAttribute('href')).toBe(`/course/${COURSE}`);
      expect(text()).toContain('Phân hệ Thanh toán liên ngân hàng');
      expect(text()).toContain('Thanh toán và đối soát');
    });

    it('reads the course once, and never the lists, to play an enrolled course', () => {
      expect(calls(learnerEndpoints.course).length).toBe(1);
      expect(calls(learnerEndpoints.course)[0][1].params).toEqual({
        courseId: String(COURSE),
      });
      expect(calls(learnerEndpoints.myCourses).length).toBe(0);
      expect(calls(learnerEndpoints.catalog).length).toBe(0);
    });

    it('renders the text of the block and, with one block only, no block list', () => {
      expect(el.querySelector('app-text-block')).not.toBeNull();
      expect(el.querySelector('app-block-list')).toBeNull();
    });

    it('saves the open silently once the server accepted it', () => {
      expect(calls(learnerEndpoints.saveProgress).length).toBe(1);
      expect(text()).not.toContain('Đã lưu tiến độ');
      expect(text()).not.toContain('Đang lưu tiến độ');
      expect(el.querySelector('.lesson__save')).toBeNull();
    });

    it('completes the last text lesson when returning to the course', async () => {
      expect(button('Đánh dấu hoàn thành')).toBeUndefined();
      el.querySelector<HTMLButtonElement>(
        '.lesson__stepbar .btn--primary',
      )?.click();
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/course/${COURSE}`),
      );
      expect(
        calls(learnerEndpoints.saveProgress).some(
          ([, request]) =>
            (request.body as { eventType: string }).eventType === 'COMPLETE',
        ),
      ).toBe(true);
      await harness.navigateByUrl(lessonUrl(2));
      await settle();
      el = harness.routeNativeElement as HTMLElement;
      expect(text()).toContain('Đã hoàn thành');
      const outlineStates = Array.from(
        el.querySelectorAll('app-lesson-outline .lesson-status__sr'),
      ).map((s) => s.textContent?.trim());
      expect(outlineStates.at(-1)).toBe('Đã hoàn thành');
      expect(text()).toMatch(/Tiến độ học\s+\d+%/);
    });

    it('puts the step bar right under the block and above the feedback', () => {
      const order = Array.from(el.querySelector('.lesson__main')!.children)
        .map((c) =>
          c.matches('.lesson__block')
            ? 'block'
            : c.matches('.lesson__stepbar')
              ? 'bar'
              : c.matches('app-lesson-feedback')
                ? 'feedback'
                : null,
        )
        .filter(Boolean);
      expect(order).toEqual(['block', 'bar', 'feedback']);
      expect(el.querySelector('.lesson__done')).toBeNull();
      expect(el.querySelectorAll('nav.lesson__steps')).toHaveLength(0);
    });

    it('explains automatic completion and offers one action to leave the final lesson', () => {
      const state = () =>
        el
          .querySelector('.lesson__state')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim();
      const primaries = () =>
        Array.from(el.querySelectorAll('.btn--primary')).map((b) =>
          b.textContent?.trim(),
        );
      expect(state()).toBe('Tiến độ sẽ được ghi khi bạn chuyển tiếp');
      expect(primaries()).toEqual(['Về khóa học']);
    });

    it('says what completes the block at the top of its card, and names it to the step bar', () => {
      const block = el.querySelector('.lesson__block')!;
      const state = block.querySelector('.lesson__block-head .lesson__state');
      expect(state?.id).toBe('lesson-block-state');
      expect(state?.getAttribute('aria-live')).toBe('polite');
      expect(
        el.querySelector('.lesson__advance')?.getAttribute('aria-describedby'),
      ).toBe('lesson-block-state');
      expect(el.querySelector('.lesson__stepbar .lesson__state')).toBeNull();
    });

    it('offers the previous lesson and no next one at the last lesson', () => {
      const previous =
        el.querySelector<HTMLAnchorElement>('.lesson__stepbar a')!;
      expect(previous.textContent).toContain('Quay lại');
      expect(previous.getAttribute('href')).toBe(
        `/lesson/${COURSE}/${lessons()[1].lesson.id}`,
      );
      expect(button('Tiếp theo')).toBeUndefined();
    });

    it('falls back to the course percentage when the server sent no completion evaluation', () => {
      const line = el
        .querySelector('.lesson__course-line')
        ?.textContent?.replace(/\s+/g, ' ');
      expect(line).toMatch(/Tiến độ khóa học \d+%/);
      expect(el.querySelector('ui-stat-strip')).toBeNull();
    });
  });

  describe('what the course still needs', () => {
    it('counts the required lessons and names the final exam, under the title and in the side panel', async () => {
      handle.mockImplementation((endpoint, request) => {
        const reply = real()(endpoint, request);
        if (endpoint !== learnerEndpoints.enrollment || !reply) return reply;
        const body = reply.body as { data: EnrollmentDetail };
        return {
          ...reply,
          body: {
            ...body,
            data: {
              ...body.data,
              completion: {
                completedRequiredLessons: 1,
                requiredLessons: 3,
                lessonsSatisfied: false,
                finalQuizId: 2,
                finalExamStatus: 'NOT_TAKEN',
                allSatisfied: false,
              },
            },
          },
        } as FakeReply;
      });
      await open(lessonUrl(2));

      expect(
        el
          .querySelector('.lesson__course-line')
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      ).toBe('Khóa học: 1/3 bài bắt buộc đã xong · Bài thi cuối: Chưa thi');
      const stats = Array.from(
        el.querySelectorAll('.lesson__side ui-stat'),
      ).map((s) => s.textContent?.replace(/\s+/g, ' ').trim());
      expect(stats).toEqual([
        expect.stringContaining('1/3'),
        expect.stringContaining('Chưa thi'),
      ]);
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

    it('shows how far a video is watched, as the server measured it, until it completes', () => {
      const head = el.querySelector('.lesson__block-head')!;
      expect(head.querySelector('.lesson__state')?.textContent).toMatch(
        /Đã xem \d+%/,
      );
      expect(
        head.querySelector('ui-progress')?.getAttribute('aria-label'),
      ).toMatch(/^Đã xem \d+% video$/);
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
      player()!.dispatchEvent(new Event('loadedmetadata'));
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

  describe('a video that allows seeking', () => {
    /** The course the server sends once the author has allowed seeking on its video block. */
    function serveSeeking(allowSeeking: boolean): void {
      const original = real();
      handle.mockImplementation((endpoint, request) => {
        const reply = original(endpoint, request);
        if (endpoint !== learnerEndpoints.course || !reply) return reply;
        const data = structuredClone(
          (reply.body as { data: LearnerCourse }).data,
        );
        for (const lesson of data.content.chapters.flatMap((c) => c.lessons)) {
          for (const { block } of lesson.blocks) {
            if (block.blockType === 'video') block.allowSeeking = allowSeeking;
          }
        }
        return { ...reply, body: { ...reply.body, data } } as FakeReply;
      });
    }
    const player = () => el.querySelector('video')!;
    const sent = () =>
      calls(learnerEndpoints.saveProgress).map(
        ([, r]) =>
          r.body as {
            eventType: string;
            videoPositionSeconds?: number;
            watchedFromSeconds?: number;
          },
      );

    it('shows the progress bar and the ±10 s buttons, and sends a SEEK without a range', async () => {
      serveSeeking(true);
      await open(lessonUrl(0));
      expect(el.querySelector('input.video__seek')).not.toBeNull();
      expect(
        el.querySelector('button[aria-label="Lùi 10 giây"]'),
      ).not.toBeNull();

      let now = 0;
      Object.defineProperty(player(), 'currentTime', {
        get: () => now,
        set: (value: number) => (now = value),
      });
      player().dispatchEvent(new Event('loadedmetadata'));
      handle.mockClear();
      now = 45;
      player().dispatchEvent(new Event('seeking'));
      await settle();

      expect(now).toBe(45);
      expect(sent()).toEqual([
        expect.objectContaining({
          eventType: 'SEEK',
          videoPositionSeconds: 45,
        }),
      ]);
      expect(sent()[0].watchedFromSeconds).toBeUndefined();
    });

    it('keeps the player as it is when the block does not allow seeking', async () => {
      serveSeeking(false);
      await open(lessonUrl(0));
      expect(el.querySelector('input.video__seek')).toBeNull();
      expect(el.querySelector('button[aria-label="Lùi 10 giây"]')).toBeNull();
    });
  });

  describe('chapters and transcript of a video', () => {
    const chapters = [
      { startSeconds: 0, title: 'Giới thiệu' },
      { startSeconds: 12, title: 'Khái niệm chính' },
    ];
    const transcript = [
      { startSeconds: 0, text: 'Xin chào.' },
      { startSeconds: 12, text: 'Khái niệm đầu tiên.' },
    ];

    /** The course the server sends once its video block has the lists. */
    function serveLists(): void {
      const original = real();
      handle.mockImplementation((endpoint, request) => {
        const reply = original(endpoint, request);
        if (endpoint !== learnerEndpoints.course || !reply) return reply;
        const data = structuredClone(
          (reply.body as { data: LearnerCourse }).data,
        );
        for (const lesson of data.content.chapters.flatMap((c) => c.lessons)) {
          for (const { block } of lesson.blocks) {
            if (block.blockType === 'video') {
              block.videoChapters = chapters;
              block.transcript = transcript;
            }
          }
        }
        return { ...reply, body: { ...reply.body, data } } as FakeReply;
      });
    }

    it('shows chapter and transcript timestamps without seek controls', async () => {
      serveLists();
      await open(lessonUrl(0));

      const chapters = Array.from(
        el.querySelectorAll<HTMLElement>('.chapters__item'),
      );
      expect(chapters.map((b) => b.textContent?.trim())).toEqual([
        '0:00 · Giới thiệu',
        '0:12 · Khái niệm chính',
      ]);
      expect(text()).toContain('Lời thoại (2 đoạn)');

      expect(
        el.querySelector('button.chapters__item, button.transcript__line'),
      ).toBeNull();
    });

    it('shows neither for a video without them', async () => {
      await open(lessonUrl(0));
      expect(el.querySelector('video')).not.toBeNull();
      expect(el.querySelector('.chapters')).toBeNull();
      expect(el.querySelector('.transcript')).toBeNull();
    });
  });

  describe('focus mode', () => {
    const toggle = () =>
      el.querySelector<HTMLButtonElement>('.lesson__focus-toggle')!;
    const side = () => el.querySelector<HTMLElement>('aside.lesson__side')!;

    beforeEach(() => localStorage.removeItem(LESSON_FOCUS_KEY));
    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.removeItem(LESSON_FOCUS_KEY);
    });

    it('starts off: the side panel is shown and the button offers the mode', async () => {
      await open(lessonUrl(2));
      expect(toggle().textContent?.trim()).toBe('Chế độ tập trung');
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(side().classList).not.toContain('lesson__side--hidden');
      expect(el.querySelector('.lesson__layout')?.classList).not.toContain(
        'lesson__layout--focus',
      );
    });

    it('hides the side panel, widens the content and offers the outline back, until toggled again', async () => {
      await open(lessonUrl(2));
      toggle().click();
      await settle();

      expect(toggle().textContent?.trim()).toBe('Hiện mục lục');
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(side().classList).toContain('lesson__side--hidden');
      expect(el.querySelector('.lesson__layout')?.classList).toContain(
        'lesson__layout--focus',
      );

      toggle().click();
      await settle();
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(side().classList).not.toContain('lesson__side--hidden');
    });

    it('keeps the focus choice in this page without persisting it', async () => {
      await open(lessonUrl(2));
      toggle().click();
      expect(localStorage.getItem(LESSON_FOCUS_KEY)).toBeNull();
      toggle().click();
      expect(localStorage.getItem(LESSON_FOCUS_KEY)).toBeNull();
    });

    it('shows the course tree on entry even with an old stored focus preference', async () => {
      localStorage.setItem(LESSON_FOCUS_KEY, 'true');
      await open(lessonUrl(2));
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      expect(toggle().textContent?.trim()).toBe('Chế độ tập trung');
      expect(side().classList).not.toContain('lesson__side--hidden');
    });

    it('still works when storage throws, for this page view', async () => {
      const getItem = Storage.prototype.getItem;
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
        this: Storage,
        key: string,
      ) {
        if (key === LESSON_FOCUS_KEY) throw new Error('blocked');
        return getItem.call(this, key);
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        if (key === LESSON_FOCUS_KEY) throw new Error('blocked');
        setItem.call(this, key, value);
      });
      await open(lessonUrl(2));
      expect(toggle().getAttribute('aria-pressed')).toBe('false');
      toggle().click();
      await settle();
      expect(toggle().getAttribute('aria-pressed')).toBe('true');
      expect(side().classList).toContain('lesson__side--hidden');
    });
  });

  describe('a lesson with several blocks', () => {
    beforeEach(() => open(lessonUrl(1)));

    // A block is a row at the third level of the outline tree: chapter, lesson, block.
    const blockRows = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          '.lesson__side [role="treeitem"][aria-level="3"]',
        ),
      );
    const choose = async (title: string) => {
      blockRows()
        .find((b) => b.textContent?.includes(title))!
        .querySelector<HTMLElement>('.tree__node')!
        .click();
      await settle();
    };

    it('lists the blocks under the lesson in "Mục lục" and starts on the first', () => {
      const items = blockRows();
      expect(items.length).toBe(4);
      expect(items[0].getAttribute('aria-selected')).toBe('true');
      expect(
        items[0].parentElement?.closest('[role="treeitem"]'),
      ).not.toBeNull();
    });

    it('offers the compact block picker too, for the screens without the outline beside the content', async () => {
      const picker = el.querySelector('app-block-list.lesson__blocks');
      expect(picker?.textContent).toContain('Khối 1/4');
      const select = picker!.querySelector('select')!;
      expect(select.options.length).toBe(4);
      select.value = select.options[2].value;
      select.dispatchEvent(new Event('change'));
      await settle();
      expect(picker!.textContent).toContain('Khối 3/4');
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

    it('says a PDF completes at its last page, and leads on with the next block as the primary', () => {
      expect(el.querySelector('.lesson__state')?.textContent?.trim()).toBe(
        'Xem đến trang cuối để hoàn thành',
      );
      const primaries = Array.from(
        el.querySelectorAll('.lesson__stepbar .btn--primary'),
      ).map((b) => b.textContent?.trim());
      expect(primaries).toEqual(['Tiếp theo']);
    });

    it('says nothing about completion on a block that completes on open', async () => {
      await choose('Mẫu báo cáo đối soát');
      expect(el.querySelector('.lesson__state')?.textContent?.trim()).toMatch(
        /^(Đã hoàn thành.*)?$/,
      );
    });

    it('opens the PDF block on the content URL of its file', () => {
      expect(el.querySelector('app-pdf-block')).not.toBeNull();
      expect(pdf.opened[0]).toMatch(
        /^\/api\/v1\/learning-assets\/\d+\/content\?blockId=\d+&enrollmentId=\d+$/,
      );
      expect(text()).toContain('Trang 1/4');
    });

    it('moves to a block, keeps it in the URL and closes the old one on the server', async () => {
      const process = blockRows().find((b) =>
        b.textContent?.includes('Các bước đối soát'),
      )!;
      handle.mockClear();
      process.querySelector<HTMLElement>('.tree__node')!.click();
      await settle();

      expect(el.querySelector('app-process-block')).not.toBeNull();
      expect(process.getAttribute('aria-selected')).toBe('true');
      expect(TestBed.inject(Router).url).toMatch(/block=\d+/);
      expect(
        calls(learnerEndpoints.saveProgress).map(
          ([, r]) => (r.body as { eventType: string }).eventType,
        ),
      ).toEqual(['CLOSE', 'OPEN']);
    });

    it('goes through the blocks with "Tiếp theo" and "Quay lại", then on to the next lesson', async () => {
      const back = () =>
        el.querySelector<HTMLElement>(
          '.lesson__stepbar button:not(.lesson__advance)',
        );
      const advance = () =>
        el.querySelector<HTMLButtonElement>('.lesson__advance')!;
      expect(back()).toBeNull();
      for (let i = 0; i < 3; i++) {
        advance().click();
        await settle();
      }
      expect(back()?.textContent).toContain('Quay lại');
      expect(el.querySelector('#lesson-block-select')).not.toBeNull();
      advance().click();
      await settle();
      expect(TestBed.inject(Router).url).toMatch(
        new RegExp(`^/lesson/${COURSE}/${lessons()[2].lesson.id}(?:\\?|$)`),
      );
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
      expect(
        Array.from(el.querySelectorAll('.btn--primary')).map((b) =>
          b.textContent?.trim(),
        ),
      ).toEqual(['Học trên thiết bị này']);

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
      el.querySelector<HTMLButtonElement>(
        '.lesson__stepbar .btn--primary',
      )?.click();
      await settle();
      expect(text()).toContain('Chưa lưu được tiến độ');
      expect(TestBed.inject(Router).url).toContain(lessonUrl(2));

      handle.mockImplementation(real());
      button('Thử lại')!.click();
      await settle();
      expect(text()).not.toContain('Đã lưu tiến độ');
      expect(text()).not.toContain('Chưa lưu được tiến độ');
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
      expect(button('Tiếp theo')?.classList.contains('btn--primary')).not.toBe(
        true,
      );
      expect(button('Mục lục')).toBeTruthy();
      expect(calls(learnerEndpoints.openSession).length).toBe(0);
      expect(calls(learnerQuizEndpoints.courseQuizzes).length).toBe(1);
    });

    it('lets the learner move on to the lessons around a quiz lesson', async () => {
      await open(`/lesson/1/${quizLesson().lesson.id}`);
      expect(button('Quay lại')?.getAttribute('href')).toMatch(
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
        endpoint === learnerEndpoints.course
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
  describe('notes and bookmarks', () => {
    const tab = (name: string) =>
      Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]')).find((t) =>
        t.textContent?.includes(name),
      )!;
    const field = () =>
      el.querySelector<HTMLTextAreaElement>('app-lesson-notes textarea')!;
    const bodies = (endpoint: unknown) =>
      calls(endpoint).map(([, request]) => request.body);
    const labelled = (label: string) =>
      el.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!;
    const press = async (node: HTMLElement | null | undefined) => {
      node!.click();
      await settle();
    };
    const typeNote = async (value: string) => {
      field().value = value;
      field().dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    const save = () =>
      press(
        Array.from(
          el.querySelectorAll<HTMLElement>('app-lesson-notes button'),
        ).find((b) => b.textContent?.includes('Lưu ghi chú')),
      );
    const noteTexts = () =>
      Array.from(el.querySelectorAll('app-lesson-notes .notes__text')).map(
        (p) => p.textContent?.trim(),
      );

    describe('on a PDF block', () => {
      beforeEach(async () => {
        await open(lessonUrl(1));
        await press(tab('Ghi chú'));
      });

      it('has the outline and the notes as tabs, the notes with their count', () => {
        expect(tab('Mục lục')).toBeTruthy();
        expect(tab('Ghi chú').textContent).toContain('0');
        expect(text()).toContain('Ghi chú tại Trang 1');
        expect(text()).toContain('Chưa có ghi chú.');
      });

      it('shows only the panel of the selected tab, not the other one beneath it', async () => {
        const panelOf = (selector: string) =>
          el.querySelector(selector)?.closest('[role="tabpanel"]');
        expect(panelOf('app-lesson-notes')?.hasAttribute('inert')).toBe(false);
        expect(panelOf('app-lesson-outline')?.hasAttribute('inert')).toBe(true);

        await press(tab('Mục lục'));
        expect(panelOf('app-lesson-notes')?.hasAttribute('inert')).toBe(true);
        expect(panelOf('app-lesson-outline')?.hasAttribute('inert')).toBe(
          false,
        );
      });

      it('saves a note on the page on screen and lists it with its anchor', async () => {
        await scrollPdf(2);
        await typeNote('Đổi CCCD cần cập nhật CIF');
        await save();

        expect(bodies(personalEndpoints.addNote)).toEqual([
          {
            anchor: {
              type: 'pdf',
              blockId: lessons()[1].blocks[0].block.id,
              page: 2,
            },
            text: 'Đổi CCCD cần cập nhật CIF',
          },
        ]);
        expect(noteTexts()).toEqual(['Đổi CCCD cần cập nhật CIF']);
        expect(
          el.querySelector('app-lesson-notes .notes__anchor')?.textContent,
        ).toContain('Trang 2');
        expect(field().value).toBe('');
        expect(tab('Ghi chú').textContent).toContain('1');
      });

      it('keeps what was typed and asks for it when the note is empty', async () => {
        await save();
        expect(calls(personalEndpoints.addNote).length).toBe(0);
        expect(text()).toContain('Hãy nhập nội dung ghi chú.');
      });

      it('asks before deleting a note, and deletes it after "Xóa"', async () => {
        await typeNote('Ghi nhớ');
        await save();
        await press(labelled('Xóa ghi chú'));
        const dialog = document.querySelector<HTMLElement>(
          '[role="alertdialog"]',
        )!;
        expect(dialog.textContent).toContain('Xóa ghi chú?');
        expect(dialog.textContent).toContain('Ghi chú sẽ bị xóa vĩnh viễn.');
        expect(calls(personalEndpoints.deleteNote).length).toBe(0);

        const cancel = Array.from(dialog.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Hủy'),
        );
        await press(cancel);
        expect(calls(personalEndpoints.deleteNote).length).toBe(0);

        await press(labelled('Xóa ghi chú'));
        const confirmButton = Array.from(
          document
            .querySelector('[role="alertdialog"]')!
            .querySelectorAll('button'),
        ).find((b) => b.textContent?.trim() === 'Xóa');
        await press(confirmButton);
        expect(calls(personalEndpoints.deleteNote).length).toBe(1);
        expect(noteTexts()).toEqual([]);
        expect(text()).toContain('Chưa có ghi chú.');
      });

      it('turns the bookmark of the page on and off from the toolbar', async () => {
        const toggle = () => labelled('Đánh dấu trang này')!;
        expect(toggle().getAttribute('aria-pressed')).toBe('false');
        await press(toggle());
        expect(toggle().getAttribute('aria-pressed')).toBe('true');
        expect(bodies(personalEndpoints.toggleBookmark)).toEqual([
          {
            anchor: {
              type: 'pdf',
              blockId: lessons()[1].blocks[0].block.id,
              page: 1,
            },
          },
        ]);
        expect(text()).toContain('Đánh dấu');
        expect(text()).toContain('Trang 1');

        await press(toggle());
        expect(toggle().getAttribute('aria-pressed')).toBe('false');
      });

      it('shows the page of a note when its anchor is followed', async () => {
        await scrollPdf(3);
        await typeNote('Trang ba');
        await save();
        await scrollPdf(1);
        expect(text()).toContain('Trang 1/4');

        await press(
          el.querySelector<HTMLElement>(
            'app-lesson-notes .notes__anchor--link',
          ),
        );
        expect(text()).toContain('Trang 3/4');
      });
    });

    describe('on a video block', () => {
      beforeEach(async () => {
        await open(lessonUrl(0));
        await press(tab('Ghi chú'));
      });

      it('names the second on screen and saves a note on it', async () => {
        const player = el.querySelector('video')!;
        Object.defineProperty(player, 'currentTime', {
          get: () => 75,
          set: () => undefined,
        });
        player.dispatchEvent(new Event('timeupdate'));
        await settle();
        expect(text()).toContain('Ghi chú tại Video 1:15');
        expect(button('Đánh dấu mốc 1:15')).toBeTruthy();

        await typeNote('Mốc quan trọng');
        await save();
        expect(bodies(personalEndpoints.addNote)).toEqual([
          {
            anchor: {
              type: 'video',
              blockId: lessons()[0].blocks[0].block.id,
              second: 75,
            },
            text: 'Mốc quan trọng',
          },
        ]);
      });
    });

    it('opens the lesson on the page of the link', async () => {
      const blockId = lessons()[1].blocks[0].block.id;
      await open(lessonUrl(1, `?block=${blockId}&page=3`));
      expect(text()).toContain('Trang 3/4');
    });

    it('labels the note with the page the link opened on', async () => {
      const blockId = lessons()[1].blocks[0].block.id;
      await open(lessonUrl(1, `?block=${blockId}&page=3`));
      await press(tab('Ghi chú'));
      expect(text()).toContain('Ghi chú tại Trang 3');
    });

    it('keeps the label on the page on screen after its dwell is reported and progress comes back', async () => {
      const blockId = lessons()[1].blocks[0].block.id;
      await open(lessonUrl(1, `?block=${blockId}&page=3`));
      await press(tab('Ghi chú'));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await settle();
      expect(text()).toContain('Ghi chú tại Trang 3');

      await typeNote('Sau khi tiến độ về');
      await save();
      expect(bodies(personalEndpoints.addNote)).toEqual([
        {
          anchor: { type: 'pdf', blockId, page: 3 },
          text: 'Sau khi tiến độ về',
        },
      ]);
    });

    it('drops the page of the link from the URL once it is shown, and keeps the block', async () => {
      const blockId = lessons()[1].blocks[0].block.id;
      await open(lessonUrl(1, `?block=${blockId}&page=3`));
      expect(text()).toContain('Trang 3/4');
      expect(TestBed.inject(Router).url).toMatch(
        new RegExp(`\\?block=${blockId}$`),
      );
    });

    it('ignores a link whose page is not a number', async () => {
      const blockId = lessons()[1].blocks[0].block.id;
      await open(lessonUrl(1, `?block=${blockId}&page=abc`));
      expect(text()).toContain('Trang 1/4');
    });

    it('shows the error with a retry when the notes cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === personalEndpoints.lessonNotes
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await open(lessonUrl(1));
      await press(tab('Ghi chú'));
      expect(text()).toContain('Không tải được ghi chú');

      handle.mockImplementation(real());
      await press(button('Thử lại'));
      expect(text()).toContain('Chưa có ghi chú.');
    });
  });
  describe('rating and comments', () => {
    const section = () => el.querySelector<HTMLElement>('app-lesson-feedback')!;
    const sectionText = () => section().textContent?.replace(/\s+/g, ' ') ?? '';
    const bodies = (endpoint: unknown) =>
      calls(endpoint).map(([, request]) => request.body);
    const press = async (node: HTMLElement | null | undefined) => {
      node!.click();
      await settle();
    };
    const star = (n: number) =>
      section().querySelector<HTMLElement>(`button[aria-label="${n} sao"]`)!;
    const tab = (name: string) =>
      Array.from(section().querySelectorAll<HTMLElement>('[role="tab"]')).find(
        (t) => t.textContent?.includes(name),
      )!;
    const panel = () =>
      Array.from(
        section().querySelectorAll<HTMLElement>('[role="tabpanel"]'),
      ).find((p) => !p.hasAttribute('inert'))!;
    const type = async (value: string) => {
      const field = panel().querySelector('textarea')!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    const send = () =>
      press(panel().querySelector<HTMLElement>('button[type="submit"]'));
    const toastText = () =>
      document.querySelector('.toasts, [role="status"], [role="alert"]')
        ?.textContent ?? '';
    const lessonId = () => lessons()[1].lesson.id;
    /** The section starts closed under the step bar; these tests read what it opens to. */
    const openFeedback = async (url: string) => {
      await open(url);
      await press(section().querySelector<HTMLElement>('.feedback__toggle'));
    };

    it('sits after the block and reads the lesson once, for the lesson on screen', async () => {
      await openFeedback(lessonUrl(1));
      expect(section()).not.toBeNull();
      expect(sectionText()).toContain('Đánh giá & trao đổi');
      expect(sectionText()).toContain('Chưa có đánh giá');
      expect(calls(feedbackEndpoints.lessonFeedback).length).toBe(1);
      expect(calls(feedbackEndpoints.lessonFeedback)[0][1].params).toEqual({
        lessonId: String(lessonId()),
      });
    });

    it('saves the stars, thanks the learner once and shows the new average', async () => {
      await openFeedback(lessonUrl(1));
      await press(star(4));
      expect(bodies(feedbackEndpoints.rateLesson)).toEqual([{ stars: 4 }]);
      expect(sectionText()).toContain('Đã ghi nhận 4 sao');
      expect(sectionText()).toContain('4,0 (1 đánh giá)');
      expect(sectionText()).not.toContain('Chưa có đánh giá');
      expect(document.body.textContent).toContain('Cảm ơn bạn đã đánh giá');
      expect(document.body.textContent).toContain('4/5 sao');
      expect(calls(feedbackEndpoints.lessonFeedback).length).toBe(2);
    });

    it('keeps the last stars when the learner arrows across them', async () => {
      await openFeedback(lessonUrl(1));
      star(2).click();
      star(3).click();
      star(5).click();
      await settle();
      expect(sectionText()).toContain('Đã ghi nhận 5 sao');
      const last = bodies(feedbackEndpoints.rateLesson).at(-1);
      expect(last).toEqual({ stars: 5 });
      // the server holds one rating, whatever reached it
      const reply = call(feedbackEndpoints.lessonFeedback, {
        lessonId: String(lessonId()),
      })?.body as { data: { myStars: number; rating: { count: number } } };
      expect(reply.data.myStars).toBe(5);
      expect(reply.data.rating.count).toBe(1);
    });

    it('keeps one rating call in flight and stores the last choice, announcing only that', async () => {
      await openFeedback(lessonUrl(1));
      const hold = TestBed.inject(ReplyGate).hold(feedbackEndpoints.rateLesson);
      star(4).click();
      await settle();
      star(3).click();
      star(2).click();
      await settle();
      expect(hold.pending()).toBe(1);
      expect(sectionText()).toContain('Đã ghi nhận 2 sao');

      hold.releaseNext();
      await settle();
      expect(hold.pending()).toBe(1);
      expect(sectionText()).toContain('Đã ghi nhận 2 sao');
      expect(document.body.textContent).not.toContain('4/5 sao');

      hold.releaseNext();
      await settle();
      expect(hold.pending()).toBe(0);
      expect(bodies(feedbackEndpoints.rateLesson)).toEqual([
        { stars: 4 },
        { stars: 2 },
      ]);
      expect(sectionText()).toContain('Đã ghi nhận 2 sao');
      expect(document.body.textContent).toContain('2/5 sao');
      expect(document.body.textContent).not.toContain('4/5 sao');
      const reply = call(feedbackEndpoints.lessonFeedback, {
        lessonId: String(lessonId()),
      })?.body as { data: { myStars: number } };
      expect(reply.data.myStars).toBe(2);
    });

    it('sends nothing more when the learner returns to the stars already on their way', async () => {
      await openFeedback(lessonUrl(1));
      const hold = TestBed.inject(ReplyGate).hold(feedbackEndpoints.rateLesson);
      star(4).click();
      await settle();
      star(2).click();
      star(4).click();
      await settle();
      hold.releaseNext();
      await settle();
      expect(hold.pending()).toBe(0);
      expect(bodies(feedbackEndpoints.rateLesson)).toEqual([{ stars: 4 }]);
      expect(sectionText()).toContain('Đã ghi nhận 4 sao');
    });

    it('sends a comment from the page on screen and lists it first', async () => {
      await openFeedback(lessonUrl(1));
      await scrollPdf(2);
      expect(sectionText()).toContain('Gửi kèm vị trí: Trang 2');
      await type('  Trang hai rất rõ  ');
      await send();
      expect(bodies(feedbackEndpoints.sendFeedback)).toEqual([
        {
          kind: 'comment',
          text: 'Trang hai rất rõ',
          anchor: {
            type: 'pdf',
            blockId: lessons()[1].blocks[0].block.id,
            page: 2,
          },
        },
      ]);
      expect(document.body.textContent).toContain('Đã gửi nhận xét');
      expect(panel().querySelector('textarea')!.value).toBe('');
      expect(sectionText()).toContain('Bạn');
      expect(sectionText()).toContain('Trang hai rất rõ');
      expect(sectionText()).toContain('tại Trang 2');
      expect(tab('Nhận xét').textContent).toContain('1');
    });

    it('keeps what was typed and shows the message when the text is too short', async () => {
      await openFeedback(lessonUrl(1));
      await type('abcd');
      await send();
      expect(calls(feedbackEndpoints.sendFeedback).length).toBe(0);
      expect(sectionText()).toContain('Nội dung cần tối thiểu 5 ký tự.');
      expect(panel().querySelector('textarea')!.value).toBe('abcd');
    });

    it('sends a question privately, with its status and no promise of a notification', async () => {
      await openFeedback(lessonUrl(1));
      await press(tab('Hỏi giảng viên'));
      await type('Đoạn này giải thích gì?');
      await send();
      expect(bodies(feedbackEndpoints.sendFeedback)).toMatchObject([
        { kind: 'question', text: 'Đoạn này giải thích gì?' },
      ]);
      expect(document.body.textContent).toContain('Đã gửi câu hỏi');
      expect(document.body.textContent).not.toContain('thông báo');
      expect(sectionText()).toContain('Chờ trả lời');
      expect(sectionText()).toContain('Đoạn này giải thích gì?');
      expect(tab('Hỏi giảng viên').textContent).toContain('1');
      await press(tab('Nhận xét'));
      expect(sectionText()).not.toContain(
        'Chưa có nhận xét.'.replace('.', '!'),
      );
    });

    it('asks before a report is sent, sends nothing on "Hủy", and sends it on confirm', async () => {
      await openFeedback(lessonUrl(1));
      await press(tab('Báo nội dung'));
      await type('Sai thông tin ở trang 1');
      await send();
      const dialog = document.querySelector<HTMLElement>(
        '[role="alertdialog"]',
      )!;
      expect(dialog.textContent).toContain('Gửi báo cáo nội dung?');
      expect(dialog.textContent).toContain(
        'Báo cáo sẽ được gửi tới giảng viên/quản trị nội dung để xem xét.',
      );
      const cancel = Array.from(dialog.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Hủy'),
      );
      await press(cancel);
      expect(calls(feedbackEndpoints.sendFeedback).length).toBe(0);
      expect(panel().querySelector('textarea')!.value).toBe(
        'Sai thông tin ở trang 1',
      );

      await send();
      const confirmButton = Array.from(
        document
          .querySelector('[role="alertdialog"]')!
          .querySelectorAll('button'),
      ).find((b) => b.textContent?.includes('Gửi báo cáo'));
      await press(confirmButton);
      expect(bodies(feedbackEndpoints.sendFeedback)).toMatchObject([
        { kind: 'report', text: 'Sai thông tin ở trang 1' },
      ]);
      expect(document.body.textContent).toContain('Đã gửi báo cáo');
      expect(sectionText()).toContain('Chờ xử lý');
    });

    it('shows a refusal of the server as a toast and keeps the text', async () => {
      await openFeedback(lessonUrl(1));
      handle.mockImplementation((endpoint, request) =>
        endpoint === feedbackEndpoints.sendFeedback
          ? backendRefusal('feedbackLimit')
          : real()(endpoint, request),
      );
      await type('Nhận xét hợp lệ');
      await send();
      expect(document.body.textContent).toContain('Đã đạt giới hạn');
      expect(panel().querySelector('textarea')!.value).toBe('Nhận xét hợp lệ');
      expect(toastText()).not.toContain('Đã gửi nhận xét');
    });

    it('loads the next page of comments on "Xem thêm nhận xét"', async () => {
      // 25 comments: the first page holds 20, one more page holds the rest. One learner cannot send
      // that many in a day, so the answers are written here.
      const comment = (id: number) => ({
        id,
        authorName: 'Học viên tích hợp Demo',
        text: `Nhận xét số ${id}`,
        anchor: { type: 'none', blockId: null, page: null, second: null },
        createTime: '2026-11-02T09:00:00Z',
        mine: false,
      });
      const ids = (from: number, to: number) =>
        Array.from({ length: from - to + 1 }, (_, i) => from - i);
      const page = (newest: number, oldest: number, index: number) => ({
        items: ids(newest, oldest).map(comment),
        page: index,
        size: 20,
        totalElements: 25,
        totalPages: 2,
      });
      handle.mockImplementation((endpoint, request) => {
        if (endpoint === feedbackEndpoints.lessonFeedback) {
          return {
            status: 200,
            body: envelopeOk({
              rating: null,
              myStars: null,
              comments: page(25, 6, 0),
              mine: [],
            }),
          } as FakeReply;
        }
        if (endpoint === feedbackEndpoints.lessonComments) {
          return {
            status: 200,
            body: envelopeOk(page(5, 1, 1)),
          } as FakeReply;
        }
        return real()(endpoint, request);
      });
      await openFeedback(lessonUrl(1));
      const more = () =>
        Array.from(section().querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Xem thêm nhận xét'),
        );
      const items = () => section().querySelectorAll('.feedback__item').length;
      expect(items()).toBe(20);
      await press(more());
      expect(calls(feedbackEndpoints.lessonComments).length).toBe(1);
      expect(calls(feedbackEndpoints.lessonComments)[0][1].query).toEqual({
        page: '1',
        size: '20',
      });
      expect(items()).toBe(25);
      expect(more()).toBeUndefined();
    });

    it('shows the error with a retry when the section cannot be read', async () => {
      handle.mockImplementation((endpoint, request) =>
        endpoint === feedbackEndpoints.lessonFeedback
          ? backendRefusal('internalError')
          : real()(endpoint, request),
      );
      await openFeedback(lessonUrl(1));
      expect(sectionText()).toContain('Không tải được đánh giá và nhận xét');

      handle.mockImplementation(real());
      await press(
        Array.from(section().querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Thử lại'),
        ),
      );
      expect(sectionText()).toContain('Chưa có đánh giá');
    });

    it('is not offered on a lesson that cannot be opened', async () => {
      await open(`/lesson/${COURSE}/999999`);
      expect(el.querySelector('app-lesson-feedback')).toBeNull();
      expect(calls(feedbackEndpoints.lessonFeedback).length).toBe(0);
    });
  });
});
