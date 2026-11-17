import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  EnrollmentDetailSchema,
  learnerEndpoints,
  type EnrollmentDetail,
} from '@lms/contracts';
import { backendRefusal, type FakeReply } from '@lms/mocks';
import type { MockInstance } from 'vitest';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { MockBackend } from '../../../../core/dev/mock-api/mock-api.interceptor';
import {
  provideMockBackendHttp,
  signInToMockBackend,
} from '../../../../core/dev/mock-api/mock-backend.testing';
import { SessionStore } from '../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../core/session/session.testing';
import { HEARTBEAT_MS } from './study-channel';
import { LessonStore } from './lesson.store';

@Component({ template: '', providers: [LessonStore] })
class Host {
  readonly store = inject(LessonStore);
}

@Component({ template: '' })
class Away {}

const COURSE = 7;

describe('LessonStore', () => {
  let handle: MockInstance<MockBackend['handle']>;
  let backend: MockBackend;
  let token: string;
  let detail: EnrollmentDetail;
  let harness: RouterTestingHarness;

  /** The backend's own `handle`, for a spec to fall back to from its spy. */
  const real = (): MockBackend['handle'] => (endpoint, request) =>
    MockBackend.prototype.handle.call(backend, endpoint, request);

  /** The lessons of course 7 in order: video + text, pdf + image + process + attachment, text. */
  const lessonIds = () =>
    detail.content.chapters.flatMap((c) => c.lessons.map((l) => l.lesson.id));
  const blocksOf = (lessonId: number) =>
    detail.content.chapters
      .flatMap((c) => c.lessons)
      .find((l) => l.lesson.id === lessonId)!
      .blocks.map((b) => b.block.id);

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'Date'],
    });
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        provideRouter([
          { path: 'lesson/:courseId/:lessonId', component: Host },
          { path: 'away', component: Away },
          { path: 'course/:id', component: Away },
        ]),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
    backend = TestBed.inject(MockBackend);
    token = signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    const original = real();
    handle = vi.spyOn(backend, 'handle');
    const call = (
      endpoint: Parameters<MockBackend['handle']>[0],
      params = {},
      body?: unknown,
    ) => original(endpoint, { token, params, query: {}, body });
    const enrolled = call(learnerEndpoints.enroll, {
      courseId: String(COURSE),
    });
    const enrollmentId = (enrolled?.body as { data: { id: number } }).data.id;
    detail = EnrollmentDetailSchema.parse(
      (
        call(learnerEndpoints.enrollment, {
          enrollmentId: String(enrollmentId),
        })?.body as { data: unknown }
      ).data,
    );
    handle.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  async function open(lessonIndex = 0, query = '') {
    harness = await RouterTestingHarness.create();
    const host = await harness.navigateByUrl(
      `/lesson/${COURSE}/${lessonIds()[lessonIndex]}${query}`,
      Host,
    );
    settle();
    return host.store;
  }

  function settle(): void {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
    }
  }

  /** Lets a router navigation started by the store finish. */
  async function settleRouter(): Promise<void> {
    settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    settle();
  }

  /** Leaves the lesson and comes back, the way a reload of the tab would. */
  async function reopen(lessonIndex: number) {
    await harness.navigateByUrl('/away');
    const host = await harness.navigateByUrl(
      `/lesson/${COURSE}/${lessonIds()[lessonIndex]}`,
      Host,
    );
    settle();
    return host.store;
  }

  const sent = (endpoint: unknown) =>
    handle.mock.calls
      .filter(([e]) => e === endpoint)
      .map(([, request]) => request.body as Record<string, unknown>);
  const events = () => sent(learnerEndpoints.saveProgress);
  const claims = () => sent(learnerEndpoints.openSession);

  /** Another device: the same account claims the session with a takeover. */
  function takeOverElsewhere(blockId: number): void {
    backend.handle(learnerEndpoints.openSession, {
      token,
      params: {},
      query: {},
      body: {
        enrollmentId: detail.enrollment.id,
        blockId,
        takeover: true,
      },
    });
  }

  it('claims the active block on entry, then sends OPEN with the next sequence', async () => {
    const store = await open(2);
    const [block] = blocksOf(lessonIds()[2]);
    expect(claims()).toEqual([
      {
        enrollmentId: detail.enrollment.id,
        blockId: block,
        takeover: false,
      },
    ]);
    expect(events()).toHaveLength(1);
    expect(events()[0]).toMatchObject({
      eventType: 'OPEN',
      sequence: 1,
      playing: false,
      complete: false,
    });
    expect(store.phase$()).toBe('ready');
    expect(store.save$()).toBe('saved');
    expect(store.activeBlock$()?.id).toBe(block);
  });

  it('opens a video at the position the claim resumes, with no range', async () => {
    await open(0);
    expect(events()[0]).toMatchObject({
      eventType: 'OPEN',
      videoPositionSeconds: 0,
    });
    expect(events()[0]).not.toHaveProperty('watchedFromSeconds');
  });

  it('takes the active block from ?block, else the first, and writes it to the URL', async () => {
    const [first, second] = blocksOf(lessonIds()[0]);
    const store = await open(0, `?block=${second}`);
    expect(store.activeBlock$()?.id).toBe(second);

    await harness.navigateByUrl('/away');
    const plain = (
      await harness.navigateByUrl(`/lesson/${COURSE}/${lessonIds()[0]}`, Host)
    ).store;
    await settleRouter();
    // Without ?block the resume point is the last block the server saw: the one opened above.
    expect(plain.activeBlock$()?.id).toBe(second);
    expect(TestBed.inject(Router).url).toContain(`block=${second}`);

    await harness.navigateByUrl('/away');
    const unknown = (
      await harness.navigateByUrl(
        `/lesson/${COURSE}/${lessonIds()[0]}?block=99999`,
        Host,
      )
    ).store;
    settle();
    expect(unknown.activeBlock$()?.id).toBe(second);
  });

  it('sends a heartbeat every 20 s while the tab is visible, and none while it is hidden', async () => {
    await open(2);
    const before = events().length;
    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(events().length).toBe(before + 1);
    expect(events().at(-1)).toMatchObject({
      eventType: 'HEARTBEAT',
      playing: false,
      sequence: before + 1,
    });

    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    vi.advanceTimersByTime(HEARTBEAT_MS * 3);
    expect(events().length).toBe(before + 1);
    visibility.mockRestore();
  });

  it('shows the result of completing the block on advance', async () => {
    const store = await open(2);
    expect(store.completion$().done).toBe(false);
    expect(store.completion$().manual).toBe(true);
    const course = store.courseProgress$();

    store.advance();
    settle();

    expect(events().at(-1)).toMatchObject({
      eventType: 'COMPLETE',
      complete: true,
    });
    expect(store.completion$().done).toBe(true);
    expect(store.activeBlock$()?.status).toBe('completed');
    expect(
      store
        .outline$()
        .flatMap((c) => c.lessons)
        .find((l) => l.current)?.state,
    ).toBe('completed');
    expect(store.courseProgress$()).toBeGreaterThan(course);
  });

  it('closes the block it leaves, then claims the next one with the previous ids', async () => {
    const store = await open(1);
    const [first, second] = blocksOf(lessonIds()[1]);
    const firstClaim = claims()[0];
    handle.mockClear();

    store.selectBlock(second);
    await settleRouter();

    expect(events().map((e) => e['eventType'])).toEqual(['CLOSE', 'OPEN']);
    expect(claims()).toHaveLength(1);
    expect(claims()[0]).toMatchObject({
      blockId: second,
      takeover: false,
      previousSessionId: expect.any(String),
      previousFence: expect.any(Number),
    });
    expect(firstClaim).toMatchObject({ blockId: first });
    expect(store.phase$()).toBe('ready');
    expect(TestBed.inject(Router).url).toContain(`block=${second}`);
  });

  it('honors the previous block URL after Next and opens it only once', async () => {
    const store = await open(1);
    await settleRouter();
    const router = TestBed.inject(Router);
    const firstUrl = router.url;
    const [first, second] = blocksOf(lessonIds()[1]);

    store.advance();
    await settleRouter();
    expect(store.activeBlock$()?.id).toBe(second);
    handle.mockClear();

    await router.navigateByUrl(firstUrl);
    await settleRouter();
    expect(store.activeBlock$()?.id).toBe(first);
    expect(claims()).toHaveLength(1);
    expect(events().map((e) => e['eventType'])).toEqual(['CLOSE', 'OPEN']);
  });

  it('keeps the media unloaded and waits for the click when another device holds the session', async () => {
    takeOverElsewhere(blocksOf(lessonIds()[2])[0]);
    handle.mockClear();
    const store = await open(2);

    expect(store.phase$()).toBe('takeover');
    expect(store.contentUrl$()).toBeNull();
    expect(events()).toHaveLength(0);
    expect(claims().every((c) => c['takeover'] === false)).toBe(true);

    store.takeOver();
    settle();

    expect(claims().at(-1)).toMatchObject({ takeover: true });
    expect(store.phase$()).toBe('ready');
    expect(events()[0]).toMatchObject({ eventType: 'OPEN' });
  });

  it('serves the content URL of the active asset only while it holds the session', async () => {
    const store = await open(0);
    const video = store.activeBlock$()!.detail.assets[0].asset.id;
    expect(store.contentUrl$()).toBe(
      `/api/v1/learning-assets/${video}/content?blockId=${store.activeBlock$()!.id}&enrollmentId=${detail.enrollment.id}`,
    );
  });

  it('claims again quietly when the lease ran out, then tells the learner when it moved', async () => {
    const store = await open(2);
    const [block] = blocksOf(lessonIds()[2]);
    takeOverElsewhere(block);

    store.advance();
    settle();

    // The event was refused as expired, the silent claim was refused as in use.
    expect(store.phase$()).toBe('moved');
    expect(claims().at(-1)).toMatchObject({ takeover: false });
    expect(store.studyError$()?.messageCode).toBe('LEARNING-SESSION_IN_USE');
    // Nothing more is saved from here, so the save line must not keep saying it was.
    expect(store.save$()).toBe('idle');
    const count = events().length;
    store.advance();
    settle();
    expect(events().length).toBe(count);
  });

  it('claims again and reads the enrolment again for a stale event, at most twice in a row', async () => {
    const store = await open(2);
    const original = real();
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.saveProgress
        ? backendRefusal('staleEvent')
        : original(endpoint, request),
    );
    handle.mockClear();

    store.advance();
    settle();
    expect(claims()).toHaveLength(1);
    expect(sent(learnerEndpoints.enrollment)).toHaveLength(1);
    expect(store.save$()).toBe('saved');

    store.advance();
    settle();
    expect(claims()).toHaveLength(2);

    store.advance();
    settle();
    // Two re-claims in a row are all it makes: the save is reported as failed.
    expect(claims()).toHaveLength(2);
    expect(store.save$()).toBe('failed');
    expect(store.phase$()).toBe('ready');
    expect(
      handle.mock.calls.filter(([e]) => e === learnerEndpoints.enrollment),
    ).toHaveLength(2);
  });

  it('keeps an event it could not save and sends the same payload on "Thử lại"', async () => {
    const store = await open(2);
    const original = real();
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.saveProgress
        ? backendRefusal('internalError')
        : original(endpoint, request),
    );
    handle.mockClear();

    store.advance();
    settle();
    expect(store.save$()).toBe('failed');
    expect(store.completion$().done).toBe(false);

    handle.mockImplementation(original);
    store.retry();
    settle();

    const [first, second] = events();
    expect(events()).toHaveLength(2);
    expect(second).toEqual(first);
    expect(store.save$()).toBe('saved');
    expect(store.completion$().done).toBe(true);
  });

  it('stops saving and says the content changed when the server reports it', async () => {
    const store = await open(2);
    const original = real();
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.saveProgress
        ? backendRefusal('mediaChanged')
        : original(endpoint, request),
    );
    store.advance();
    settle();
    expect(store.phase$()).toBe('media-changed');
  });

  it('shows the block error for an asset still being processed, leaving the page usable', async () => {
    const original = real();
    handle.mockImplementation((endpoint, request) =>
      endpoint === learnerEndpoints.openSession
        ? backendRefusal('assetProcessing')
        : original(endpoint, request),
    );
    const store = await open(0);
    expect(store.phase$()).toBe('block-error');
    expect(store.view$()).toBe('ready');
  });

  it('sends CLOSE when the page is left', async () => {
    await open(2);
    handle.mockClear();
    TestBed.resetTestingModule();
    expect(events().map((e) => e['eventType'])).toEqual(['CLOSE']);
  });

  it('claims with the ids the tab held, so a reload is not asked to take over', async () => {
    await open(2);
    const held = claims()[0];
    expect(held).not.toHaveProperty('previousSessionId');
    const stored = sessionStorage.getItem(
      `lms.study-session.v1.000004.${detail.enrollment.id}`,
    );
    expect(stored).not.toBeNull();

    handle.mockClear();
    const reopened = await reopen(2);
    expect(claims()[0]).toMatchObject({
      takeover: false,
      previousSessionId: JSON.parse(stored!).sessionId,
    });
    expect(reopened.phase$()).toBe('ready');
  });

  describe('what the course still needs', () => {
    /** The enrolment as a server that evaluates completion sends it; `done` counts its reads. */
    function serveCompletion(): { readonly reads: () => number } {
      let reads = 0;
      handle.mockImplementation((endpoint, request) => {
        const reply = real()(endpoint, request);
        if (endpoint !== learnerEndpoints.enrollment || !reply) return reply;
        reads += 1;
        const body = reply.body as { data: EnrollmentDetail };
        return {
          ...reply,
          body: {
            ...body,
            data: {
              ...body.data,
              completion: {
                completedRequiredLessons: reads,
                requiredLessons: 3,
                lessonsSatisfied: false,
                finalQuizId: 2,
                finalExamStatus: 'NOT_PASSED',
                allSatisfied: false,
              },
            },
          },
        } as FakeReply;
      });
      return { reads: () => reads };
    }

    it('shows the evaluation the enrolment came with, and reads it only once while nothing completes', async () => {
      const server = serveCompletion();
      const store = await open(1);
      expect(store.courseCompletion$()).toMatchObject({
        required: { done: 1, total: 3 },
        finalExam: { label: 'Chưa đạt', failed: true },
      });
      expect(server.reads()).toBe(1);
    });

    it('reads the evaluation again once a lesson completes here', async () => {
      const server = serveCompletion();
      const store = await open(2);
      store.advance();
      settle();
      expect(server.reads()).toBe(2);
      expect(store.courseCompletion$().required).toEqual({ done: 2, total: 3 });
    });

    it('says nothing it was not told: no evaluation, no count and no exam', async () => {
      const store = await open(2);
      expect(store.courseCompletion$()).toMatchObject({
        required: null,
        finalExam: null,
      });
      expect(store.courseCompletion$().percent).toBe(store.courseProgress$());
    });
  });

  describe('the session alert', () => {
    it('is up, so the step bar steps back from primary, only while the learner must act on it', async () => {
      takeOverElsewhere(blocksOf(lessonIds()[2])[0]);
      const store = await open(2);
      expect(store.phase$()).toBe('takeover');
      expect(store.sessionBlocked$()).toBe(true);
      store.takeOver();
      settle();
      expect(store.sessionBlocked$()).toBe(false);
    });
  });

  describe('a lesson with nothing to study', () => {
    async function openUrl(url: string) {
      harness = await RouterTestingHarness.create();
      const host = await harness.navigateByUrl(url, Host);
      settle();
      return host.store;
    }

    it('claims no session for a lesson that is not in the course', async () => {
      const store = await openUrl(`/lesson/${COURSE}/999999`);
      expect(store.view$()).toBe('missing');
      expect(claims()).toHaveLength(0);
    });

    it('claims no session for a quiz lesson opened by URL', async () => {
      const mine = backend.handle(learnerEndpoints.myCourses, {
        token,
        params: {},
        query: { size: '100' },
        body: undefined,
      });
      const card = (
        mine?.body as {
          data: { items: { courseId: number; enrollmentId: number }[] };
        }
      ).data.items.find((c) => c.courseId === 1)!;
      const course = EnrollmentDetailSchema.parse(
        (
          backend.handle(learnerEndpoints.enrollment, {
            token,
            params: { enrollmentId: String(card.enrollmentId) },
            query: {},
            body: undefined,
          })?.body as { data: unknown }
        ).data,
      );
      const quiz = course.content.chapters
        .flatMap((c) => c.lessons)
        .find((l) => l.lesson.lessonType === 'quiz')!;
      handle.mockClear();

      const store = await openUrl(`/lesson/1/${quiz.lesson.id}`);
      expect(store.view$()).toBe('quiz');
      expect(claims()).toHaveLength(0);
    });

    it('claims no session for a course the learner is not enrolled in', async () => {
      const store = await openUrl('/lesson/3/1');
      expect(store.view$()).toBe('not-enrolled');
      expect(claims()).toHaveLength(0);
    });
  });
  describe('the anchor of a note', () => {
    const pdfOf = (lessonIndex: number) =>
      detail.content.chapters
        .flatMap((c) => c.lessons)
        .find((l) => l.lesson.id === lessonIds()[lessonIndex])!
        .blocks.find((b) => b.block.blockType === 'pdf')!.block.id;

    /** Another lesson in the same test: the harness is made once. */
    const openAgain = async (lessonIndex: number, query = '') => {
      await harness.navigateByUrl('/away');
      const host = await harness.navigateByUrl(
        `/lesson/${COURSE}/${lessonIds()[lessonIndex]}${query}`,
        Host,
      );
      settle();
      return host.store;
    };

    it('follows the page of the PDF and the second of the video on screen', async () => {
      const pdfStore = await open(1);
      const pdf = pdfOf(1);
      expect(pdfStore.anchor$()).toEqual({ type: 'none' });
      expect(pdfStore.anchorLabel$()).toBe('bài học');
      pdfStore.pdfPageChange(3);
      expect(pdfStore.anchor$()).toEqual({
        type: 'pdf',
        blockId: pdf,
        page: 3,
      });
      expect(pdfStore.anchorLabel$()).toBe('Trang 3');
      pdfStore.selectBlock(blocksOf(lessonIds()[1])[1]);
      await settleRouter();
      expect(pdfStore.anchor$()).toEqual({ type: 'none' });

      const videoStore = await openAgain(0);
      expect(videoStore.anchorLabel$()).toBe('Video 0:00');
      videoStore.videoSecond(75);
      expect(videoStore.anchor$()).toEqual({
        type: 'video',
        blockId: blocksOf(lessonIds()[0])[0],
        second: 75,
      });
      expect(videoStore.anchorLabel$()).toBe('Video 1:15');
    });

    it('opens the block of an anchor on another block, then asks it to show the page', async () => {
      const store = await open(1);
      const pdf = pdfOf(1);
      store.selectBlock(blocksOf(lessonIds()[1])[1]);
      await settleRouter();
      expect(store.pdfJump$()).toBeNull();

      store.followAnchor({ type: 'pdf', blockId: pdf, page: 3, second: null });
      await settleRouter();
      expect(store.activeBlock$()?.id).toBe(pdf);
      expect(store.pdfJump$()).toMatchObject({ blockId: pdf, value: 3 });

      const first = store.pdfJump$();
      store.followAnchor({ type: 'pdf', blockId: pdf, page: 3, second: null });
      expect(store.pdfJump$()).not.toBe(first);
      expect(store.pdfJump$()?.value).toBe(3);
    });

    it('forgets the page asked for once the learner picks a block', async () => {
      const store = await open(1);
      const pdf = pdfOf(1);
      store.followAnchor({ type: 'pdf', blockId: pdf, page: 3, second: null });
      store.selectBlock(blocksOf(lessonIds()[1])[1]);
      await settleRouter();
      store.selectBlock(pdf);
      await settleRouter();
      expect(store.pdfJump$()).toBeNull();
    });

    it('does nothing for a note on the whole lesson, and closes the drawer for one with a spot', async () => {
      const store = await open(1);
      const pdf = pdfOf(1);
      store.openOutline();
      store.followAnchor({
        type: 'none',
        blockId: null,
        page: null,
        second: null,
      });
      expect(store.pdfJump$()).toBeNull();
      expect(store.outlineOpen$()).toBe(true);

      store.followAnchor({ type: 'pdf', blockId: pdf, page: 2, second: null });
      expect(store.outlineOpen$()).toBe(false);
    });

    it('reads ?page on its PDF block and ignores old video timestamp links', async () => {
      const pdf = pdfOf(1);
      const pdfStore = await open(1, `?block=${pdf}&page=3`);
      expect(pdfStore.pdfJump$()).toMatchObject({ blockId: pdf, value: 3 });

      const video = blocksOf(lessonIds()[0])[0];
      const videoStore = await openAgain(0, `?block=${video}&t=75`);
      expect(videoStore.activeBlock$()?.id).toBe(video);
      expect(videoStore.resume$()?.lastVideoPositionSeconds ?? 0).toBe(0);
    });

    it.each([
      ['a page of zero', 'page=0'],
      ['a page that is not a number', 'page=abc'],
      ['a negative page', 'page=-2'],
      ['a second where a page is meant', 't=30'],
    ])('ignores a link with %s', async (_, query) => {
      const pdf = pdfOf(1);
      const store = await open(1, `?block=${pdf}&${query}`);
      expect(store.pdfJump$()).toBeNull();
    });

    it('ignores the page of a link that names another block', async () => {
      const [first, second] = blocksOf(lessonIds()[1]);
      const store = await open(1, `?block=${second}&page=3`);
      expect(store.activeBlock$()?.id).toBe(second);
      expect(first).toBeDefined();
      expect(store.pdfJump$()).toBeNull();
    });

    it('drops the page from the URL once the learner moves to another block', async () => {
      const pdf = pdfOf(1);
      const store = await open(1, `?block=${pdf}&page=3`);
      store.selectBlock(blocksOf(lessonIds()[1])[1]);
      await settleRouter();
      const url = TestBed.inject(Router).url;
      expect(url).toContain('block=');
      expect(url).not.toContain('page=');
    });
  });
});
