import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CourseJobSummary } from '@lms/contracts';
import { envelopeOk, seedMe } from '@lms/mocks';
import { parseAppConfig, provideAppConfig } from '../config/app-config';
import { testAppConfig } from '../config/app-config.testing';
import { provideEnvelopeHttpClient } from '../http/http.testing';
import { SessionStore } from '../session/session.store';
import { FakeSessionStore } from '../session/session.testing';
import { toProfile } from '../session/to-profile';
import {
  COURSE_NOTICE_MS,
  COURSE_POLL_INTERVAL_MS,
  CourseJobTrackerStore,
} from './course-job-tracker.store';

const LIST = '/api/v1/assistant/course-jobs';

const job = (patch: Partial<CourseJobSummary> = {}): CourseJobSummary => ({
  jobId: 7,
  status: 'running',
  step: 'summarise_sections',
  progress: 20,
  error: null,
  sourceFileName: 'quy-trinh.md',
  createdDraftId: null,
  createTime: new Date().toISOString(),
  ...patch,
});

describe('CourseJobTrackerStore', () => {
  let backend: HttpTestingController;
  let session: FakeSessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideAppConfig(parseAppConfig(testAppConfig())),
        provideEnvelopeHttpClient(),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: ErrorHandler, useValue: { handleError: () => undefined } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore) as unknown as FakeSessionStore;
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
    await Promise.resolve();
  }

  const requests = (): TestRequest[] => backend.match((r) => r.url === LIST);

  async function start(...items: CourseJobSummary[]) {
    session.user.set(toProfile(seedMe('000005')));
    const store = TestBed.inject(CourseJobTrackerStore);
    await settle();
    requests()[0].flush(envelopeOk(items));
    await settle();
    return store;
  }

  it('asks nothing for a learner, who cannot generate a course', async () => {
    session.user.set(toProfile(seedMe('000004')));
    const store = TestBed.inject(CourseJobTrackerStore);
    await settle();
    vi.advanceTimersByTime(10_000);
    await settle();

    expect(requests()).toHaveLength(0);
    expect(store.live$()).toEqual([]);
  });

  it('reads the running jobs when the app starts, so a reload keeps the progress', async () => {
    const store = await start(job(), job({ jobId: 3, status: 'completed' }));

    expect(store.live$().map((j) => j.jobId)).toEqual([7]);
    expect(store.progress$()).toBe(20);
  });

  it('polls while a job runs and announces it when it waits for the author', async () => {
    const store = await start(job());

    vi.advanceTimersByTime(COURSE_POLL_INTERVAL_MS);
    await settle();
    requests()[0].flush(
      envelopeOk([job({ status: 'waiting_approval', progress: 30 })]),
    );
    await settle();

    expect(store.live$()).toEqual([]);
    expect(store.lastFinished$()?.job.jobId).toBe(7);
    expect(store.lastFinished$()?.job.status).toBe('waiting_approval');
  });

  it('stops polling once nothing runs and drops the notice after a while', async () => {
    const store = await start(job());
    vi.advanceTimersByTime(COURSE_POLL_INTERVAL_MS);
    await settle();
    requests()[0].flush(envelopeOk([job({ status: 'failed', error: 'Lỗi.' })]));
    await settle();
    expect(store.lastFinished$()?.job.status).toBe('failed');

    vi.advanceTimersByTime(COURSE_NOTICE_MS);
    await settle();
    expect(store.lastFinished$()).toBeNull();
    vi.advanceTimersByTime(COURSE_POLL_INTERVAL_MS * 3);
    await settle();
    expect(requests()).toHaveLength(0);
  });

  it('tracks a job that a confirmed card started and asks for it at once', async () => {
    const store = await start();

    store.trackById(11);
    await settle();

    expect(store.live$().map((j) => j.jobId)).toEqual([11]);
    requests()[0].flush(envelopeOk([job({ jobId: 11, progress: 10 })]));
    await settle();
    expect(store.progress$()).toBe(10);
  });
});
