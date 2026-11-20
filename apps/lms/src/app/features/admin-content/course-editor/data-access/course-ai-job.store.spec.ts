import { AI_COURSE_COMPOSE_ENABLED } from '../../../../core/course-jobs/course-job-access';
import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CourseDetail, CourseJob, LessonAiState } from '@lms/contracts';
import { courseDetailFixtures, envelopeOk, seedMe } from '@lms/mocks';
import {
  parseAppConfig,
  provideAppConfig,
} from '../../../../core/config/app-config';
import { testAppConfig } from '../../../../core/config/app-config.testing';
import { provideEnvelopeHttpClient } from '../../../../core/http/http.testing';
import { SessionStore } from '../../../../core/session/session.store';
import { FakeSessionStore } from '../../../../core/session/session.testing';
import { toProfile } from '../../../../core/session/to-profile';
import {
  COURSE_AI_POLL_INTERVAL_MS,
  CourseAiJobStore,
} from './course-ai-job.store';
import { CourseEditorStore } from './course-editor.store';

const JOBS = '/api/v1/assistant/course-jobs';
const COURSE_ID = 55;

const jobOf = (patch: Partial<CourseJob> = {}): CourseJob => ({
  jobId: 7,
  status: 'running',
  step: 'lesson',
  progress: 40,
  error: null,
  inputs: {
    targetLearners: 'Giao dịch viên mới',
    level: 'BEGINNER',
    chapters: 2,
    programmeId: 5,
    competencyId: 9,
  },
  ownerOrgId: 1,
  steps: [],
  createTime: '2026-11-12T08:00:00+07:00',
  updateTime: '2026-11-12T08:00:00+07:00',
  courseId: COURSE_ID,
  revisionId: 300,
  ...patch,
});

/** The fixture course as the AI left it: its lessons take these states in order. */
const courseWith = (states: readonly LessonAiState[]): CourseDetail => {
  const base = courseDetailFixtures.find((d) => d.course.code === 'VH-301')!;
  let next = 0;
  return {
    ...base,
    course: { ...base.course, id: COURSE_ID },
    revision: { ...base.revision, aiGenerated: true },
    chapters: base.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((entry) => ({
        ...entry,
        lesson: { ...entry.lesson, aiState: states[next++] ?? null },
      })),
    })),
  };
};

const content = {
  jobId: 7,
  status: 'running',
  progress: 40,
  outlineLocked: true,
  lessons: [],
  questions: [],
};

// The AI job UI is hidden while AI_COURSE_COMPOSE_ENABLED is off.
describe.skipIf(!AI_COURSE_COMPOSE_ENABLED)('CourseAiJobStore', () => {
  let backend: HttpTestingController;
  const course = signal<CourseDetail | undefined>(undefined);
  const reloadCourse = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    reloadCourse.mockClear();
    course.set(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
        {
          provide: CourseEditorStore,
          useValue: { course$: course.asReadonly(), reloadCourse },
        },
        CourseAiJobStore,
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    (TestBed.inject(SessionStore) as unknown as FakeSessionStore).user.set(
      toProfile(seedMe('000005')),
    );
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  }

  const call = (method: string, url: string): TestRequest[] =>
    backend.match((r) => r.method === method && r.url === url);

  /** Opens an AI course whose job runs; the job is found in the list and read. */
  async function open(
    states: readonly LessonAiState[],
    job: CourseJob = jobOf(),
  ) {
    const store = TestBed.inject(CourseAiJobStore);
    course.set(courseWith(states));
    await settle();
    call('GET', JOBS)[0].flush(
      envelopeOk([
        { ...job, sourceFileName: null, createdDraftId: null, error: null },
        { ...jobOf({ jobId: 3, courseId: 12 }) },
      ]),
    );
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(job));
    await settle();
    return store;
  }

  it('asks nothing for a course the AI did not start', async () => {
    const store = TestBed.inject(CourseAiJobStore);
    course.set({
      ...courseWith([]),
      revision: { ...courseWith([]).revision, aiGenerated: false },
    });
    await settle();
    vi.advanceTimersByTime(COURSE_AI_POLL_INTERVAL_MS * 2);
    await settle();

    expect(call('GET', JOBS)).toHaveLength(0);
    expect(store.job$()).toBeUndefined();
  });

  it('finds the job of the course by its courseId and reads the course for it', async () => {
    const store = await open(['written', 'writing', 'pending', 'pending']);

    expect(store.job$()?.jobId).toBe(7);
    expect(reloadCourse).toHaveBeenCalledTimes(1);
    expect(store.phase$()).toBe('writing');
    expect(store.statusLine$()).toBe('Đang viết bài 2/3…');
    expect(store.isWriting(0, 1)).toBe(true);
  });

  it('polls every 3 s while the job runs, reloads the lessons it wrote and stops when it ends', async () => {
    const store = await open(['written', 'writing', 'pending', 'pending']);

    vi.advanceTimersByTime(COURSE_AI_POLL_INTERVAL_MS);
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(jobOf({ progress: 70 })));
    await settle();
    expect(reloadCourse).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(COURSE_AI_POLL_INTERVAL_MS);
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(
      envelopeOk(jobOf({ status: 'completed', progress: 100, step: null })),
    );
    await settle();
    expect(reloadCourse).toHaveBeenCalledTimes(3);
    expect(store.running$()).toBe(false);

    vi.advanceTimersByTime(COURSE_AI_POLL_INTERVAL_MS * 4);
    await settle();
    expect(call('GET', `${JOBS}/7`)).toHaveLength(0);
  });

  it('does not poll while the tab is hidden', async () => {
    await open(['written', 'writing', 'pending', 'pending']);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    vi.advanceTimersByTime(COURSE_AI_POLL_INTERVAL_MS * 4);
    await settle();

    expect(call('GET', `${JOBS}/7`)).toHaveLength(0);
  });

  it('says what the AI does before approval and locks the structure only while it writes lessons', async () => {
    const outline = await open(
      ['pending', 'pending', 'pending', 'pending'],
      jobOf({ step: 'outline', progress: 20 }),
    );
    expect(outline.statusLine$()).toBe('Đang tạo dàn ý…');
    expect(outline.structureLock$()).toBeNull();
  });

  it('locks the structure while the lessons are written and says why', async () => {
    const store = await open(['written', 'writing', 'pending', 'pending']);

    expect(store.structureLock$()).toContain('AI đang viết bài');
  });

  it('approves the outline, then follows the job again', async () => {
    const store = await open(
      ['pending', 'pending', 'pending', 'pending'],
      jobOf({ status: 'waiting_approval', step: 'outline', progress: 30 }),
    );
    expect(store.phase$()).toBe('approval');

    store.approve();
    await settle();
    call('POST', `${JOBS}/7/outline/approve`)[0].flush(envelopeOk(content));
    await settle();

    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(jobOf()));
    await settle();
    expect(store.phase$()).toBe('writing');
  });

  it('stops a running job, and the lessons it kept stay', async () => {
    const store = await open(['written', 'writing', 'pending', 'pending']);

    store.stop();
    await settle();
    call('POST', `${JOBS}/7/stop`)[0].flush(
      envelopeOk(jobOf({ status: 'stopped' })),
    );
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(jobOf({ status: 'stopped' })));
    await settle();

    expect(store.phase$()).toBe('stopped');
    expect(store.running$()).toBe(false);
  });

  it('retries a failed job', async () => {
    const store = await open(
      ['written', 'pending', 'pending', 'pending'],
      jobOf({ status: 'failed', error: 'Mô hình trả về dữ liệu không hợp lệ' }),
    );
    expect(store.phase$()).toBe('failed');

    store.retry();
    await settle();
    call('POST', `${JOBS}/7/retry`)[0].flush(envelopeOk(content));
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(jobOf()));
    await settle();

    expect(store.running$()).toBe(true);
  });

  it('rewrites one lesson by its key', async () => {
    const store = await open(
      ['written', 'written', 'user_edited', 'written'],
      jobOf({ status: 'completed', step: null, progress: 100 }),
    );
    expect(store.canRewrite(0, 1)).toBe(true);

    store.rewrite(0, 1);
    await settle();
    call('POST', `${JOBS}/7/lessons/c1l2/regenerate`)[0].flush(
      envelopeOk(content),
    );
    await settle();
    call('GET', `${JOBS}/7`)[0].flush(envelopeOk(jobOf()));
    await settle();

    expect(store.running$()).toBe(true);
  });
});
