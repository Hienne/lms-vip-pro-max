import { TestBed } from '@angular/core/testing';
import { learnerEndpoints, learnerQuizEndpoints } from '@lms/contracts';
import { backendRefusal } from '@lms/mocks';
import { NOW } from '@lms/ui';
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
import { LEARN_TABS, LearnStore } from './learn.store';

describe('LearnStore', () => {
  let handle: MockInstance<MockBackend['handle']>;
  const original = (endpoint: unknown, request: unknown) =>
    MockBackend.prototype.handle.call(
      TestBed.inject(MockBackend),
      endpoint as never,
      request as never,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideMockBackendHttp(),
        provideAppConfig(
          parseAppConfig(testAppConfig({ mockApi: true, mockBackend: true })),
        ),
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: NOW, useValue: () => Date.now() },
        LearnStore,
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
    const store = TestBed.inject(LearnStore);
    await settle();
    return store;
  }

  const queries = (endpoint: unknown) =>
    handle.mock.calls
      .filter(([e]) => e === endpoint)
      .map(([, request]) => request.query);

  /** Fails one endpoint, leaving the rest as the mock answers them. */
  function fail(endpoint: unknown) {
    handle.mockImplementation((e, request) =>
      e === endpoint ? backendRefusal('internalError') : original(e, request),
    );
  }

  it('keeps the selected course tab when opening the complete catalogue', async () => {
    const store = await open();
    for (const [tab, query] of [
      ['in_progress', { scope: 'mine', status: 'in_progress' }],
      ['not_started', { scope: 'mine', status: 'not_started' }],
      ['completed', { scope: 'mine', status: 'completed' }],
      ['mandatory', { scope: 'mine', requirement: 'mandatory' }],
      ['assigned', { scope: 'assigned' }],
    ] as const) {
      store.showTab(tab);
      expect(store.allCoursesQuery$()).toEqual(query);
    }
  });

  it('asks for the in-progress course touched last, then for that enrolment', async () => {
    const store = await open();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      learningStatus: 'in_progress',
      sort: 'lastAccessAt,desc',
      size: '5',
    });
    expect(
      handle.mock.calls.filter(([e]) => e === learnerEndpoints.enrollment),
    ).toHaveLength(1);
    const resume = store.resume$();
    expect(resume?.link).toMatch(/^\/lesson\/\d+\/\d+$/);
    expect(resume?.pct).toBeGreaterThan(0);
    expect(resume?.context).toContain(' · ');
    expect(resume?.context.startsWith(resume.courseTitle)).toBe(true);
    expect(resume?.position?.number).toBeGreaterThan(0);
    expect(resume?.position?.total).toBeGreaterThanOrEqual(
      resume?.position?.number ?? 0,
    );
  });

  it('has no resume card for a learner with nothing in progress', async () => {
    const store = await open('quantri', '000002');
    expect(store.resume$()).toBeNull();
    expect(store.isResumeLoading$()).toBe(false);
  });

  it('shows the in-progress tab first and the summary counts on the five tabs', async () => {
    const store = await open();
    expect(store.tab$()).toBe('in_progress');
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      learningStatus: 'in_progress',
      sort: 'lastAccessAt,desc',
      page: '0',
      size: '50',
    });
    const counts = store.tabCounts$();
    expect(counts.in_progress).toBeGreaterThan(0);
    expect(Object.keys(counts).sort()).toEqual(LEARN_TABS.slice().sort());
    expect(counts).toEqual({
      in_progress: store.summary$()?.counts.inProgress,
      not_started: store.summary$()?.counts.notStarted,
      completed: store.summary$()?.counts.completed,
      mandatory: store.summary$()?.counts.mandatory,
      assigned: store.summary$()?.counts.assigned,
    });
  });

  it('asks the server for each tab: the three statuses, mandatory by requirement and assigned by flag', async () => {
    const store = await open();
    store.showTab('not_started');
    await settle();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      learningStatus: 'not_started',
      sort: 'dueAt,asc',
      page: '0',
      size: '50',
    });
    store.showTab('mandatory');
    await settle();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      requirement: 'mandatory',
      sort: 'dueAt,asc',
      page: '0',
      size: '50',
    });
    store.showTab('assigned');
    await settle();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      assigned: 'true',
      sort: 'dueAt,asc',
      page: '0',
      size: '50',
    });
    store.showTab('bogus');
    expect(store.tab$()).toBe('assigned');
  });

  it('keeps the dated, still open courses of one server page by due date, at most five', async () => {
    const store = await open();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      sort: 'dueAt,asc',
      size: '10',
    });
    const rows = store.due$();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.every((row) => row.link.startsWith('/course/'))).toBe(true);
  });

  it("carries each due row's progress percent from its card, unchanged", async () => {
    const store = await open();
    const cards = await Promise.resolve(
      handle.mock.results
        .map((r) => r.value as { body?: { data?: { items?: unknown[] } } })
        .flatMap((r) => r?.body?.data?.items ?? []),
    );
    const percent = new Map(
      (cards as { courseId: number; progressPercent: number | null }[]).map(
        (c) => [`/course/${c.courseId}`, c.progressPercent ?? 0],
      ),
    );
    for (const row of store.due$()) expect(row.pct).toBe(percent.get(row.link));
  });

  it('shows the first three reminders, the soonest due first', async () => {
    const store = await open();
    const rows = store.reminders$();
    expect(rows).toHaveLength(3);
    const due = rows.map((r) => r.reminder.dueAtSnapshot ?? '');
    expect(due).toEqual([...due].sort());
    expect(rows[0].isOverdue).toBe(true);
  });

  it('does not ask for reminders when the user has no COURSE_LEARNING function', async () => {
    const store = await open('quantri', '000002');
    expect(queries(learnerEndpoints.reminders)).toHaveLength(0);
    expect(store.reminders$()).toEqual([]);
    expect(store.remindersError$()).toBeUndefined();
  });

  it('reads a 403 on reminders as none', async () => {
    handle.mockImplementation((e, request) =>
      e === learnerEndpoints.reminders
        ? backendRefusal('accessDenied')
        : original(e, request),
    );
    const store = await open();
    expect(store.reminders$()).toEqual([]);
    expect(store.remindersError$()).toBeUndefined();
  });

  it('reads neither the programmes nor the competencies', async () => {
    await open();
    expect(
      handle.mock.calls.some(
        ([e]) =>
          e === learnerQuizEndpoints.myCompetency ||
          e === learnerEndpoints.dashboardPrograms,
      ),
    ).toBe(false);
  });

  it('resumes the course touched last that still has lessons left', async () => {
    type Page = { items: { progressPercent: number | null }[] };
    handle.mockImplementation((e, request) => {
      const reply = original(e, request) as {
        body: { data?: Page };
      };
      const items = reply?.body?.data?.items;
      if (
        e !== learnerEndpoints.myCourses ||
        request.query?.['size'] !== '5' ||
        !items?.length
      ) {
        return reply as never;
      }
      // The course touched last has every lesson done but is still in progress (exam not passed).
      items[0].progressPercent = 100;
      return reply as never;
    });
    const store = await open();
    expect(store.resume$()).not.toBeNull();
    expect(store.resume$()?.pct).toBeLessThan(100);
  });

  it('reads the points once, and a failing read leaves no points and no other error', async () => {
    const store = await open();
    expect(queries(learnerEndpoints.myPoints)).toHaveLength(1);
    expect(store.points$()).toMatchObject({ total: 80, streakDays: 2 });
  });

  it('has no points when the read fails, and the other sections still load', async () => {
    fail(learnerEndpoints.myPoints);
    const store = await open();
    expect(store.points$()).toBeUndefined();
    expect(store.summary$()).toBeDefined();
    expect(store.summaryError$()).toBeUndefined();
    expect(store.courses$().length).toBeGreaterThan(0);
  });

  it('lets one failing section fail alone', async () => {
    fail(learnerEndpoints.progressSummary);
    const store = await open();
    expect(store.summaryError$()).toBeTruthy();
    expect(store.resumeError$()).toBeUndefined();
    expect(store.coursesError$()).toBeUndefined();
    expect(store.dueError$()).toBeUndefined();
    expect(store.courses$().length).toBeGreaterThan(0);
    expect(store.reminders$()).toHaveLength(3);
  });

  it('reads the dashboard once, for the completion rate the server computed', async () => {
    const store = await open();
    expect(queries(learnerEndpoints.dashboard)).toHaveLength(1);
    const counts = store.dashboardCounts$();
    expect(counts?.courses).toBe(store.summary$()?.counts.total);
    expect(counts?.completed).toBe(store.summary$()?.counts.completed);
    expect(store.dashboardError$()).toBeUndefined();
  });

  it('keeps the summary when the dashboard fails, and reads it again on retry', async () => {
    fail(learnerEndpoints.dashboard);
    const store = await open();
    expect(store.dashboardError$()).toBeTruthy();
    expect(store.dashboardCounts$()).toBeUndefined();
    expect(store.summary$()).toBeDefined();
    expect(store.summaryError$()).toBeUndefined();

    handle.mockImplementation((e, request) => original(e, request));
    store.retryDashboard();
    await settle();
    expect(store.dashboardError$()).toBeUndefined();
    expect(store.dashboardCounts$()?.completionRate).toBeGreaterThanOrEqual(0);
  });
});
