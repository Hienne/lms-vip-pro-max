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

  it('asks for the in-progress course touched last, then for that enrolment', async () => {
    const store = await open();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      learningStatus: 'in_progress',
      sort: 'lastAccessAt,desc',
      size: '1',
    });
    expect(
      handle.mock.calls.filter(([e]) => e === learnerEndpoints.enrollment),
    ).toHaveLength(1);
    const resume = store.resume$();
    expect(resume?.link).toMatch(/^\/lesson\/\d+\/\d+$/);
    expect(resume?.pct).toBeGreaterThan(0);
    expect(resume?.context).toContain(' · ');
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
      size: '6',
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
      size: '6',
    });
    store.showTab('mandatory');
    await settle();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      requirement: 'mandatory',
      sort: 'dueAt,asc',
      size: '6',
    });
    store.showTab('assigned');
    await settle();
    expect(queries(learnerEndpoints.myCourses)).toContainEqual({
      assigned: 'true',
      sort: 'dueAt,asc',
      size: '6',
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

  it('reads the competencies of every course, with no course filter', async () => {
    const store = await open();
    const calls = handle.mock.calls.filter(
      ([e]) => e === learnerQuizEndpoints.myCompetency,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][1].query).toEqual({});
    expect(store.competency$()?.length).toBeGreaterThan(0);
    expect(store.competencyError$()).toBeUndefined();
    expect(store.isCompetencyLoading$()).toBe(false);
  });

  it('is loading the competencies until the first read arrives', () => {
    signInToMockBackend('hocvien');
    fakeSession().user.set(seedProfile('000004'));
    const store = TestBed.inject(LearnStore);
    expect(store.isCompetencyLoading$()).toBe(true);
    expect(store.competency$()).toBeUndefined();
  });

  it('keeps the summary when the competency read fails, and reads again on retry', async () => {
    fail(learnerQuizEndpoints.myCompetency);
    const store = await open();
    expect(store.competencyError$()).toBeTruthy();
    expect(store.competency$()).toBeUndefined();
    expect(store.summaryError$()).toBeUndefined();
    expect(store.summary$()?.counts.total).toBeGreaterThan(0);
    expect(store.courses$().length).toBeGreaterThan(0);

    handle.mockImplementation(original);
    store.retryCompetency();
    await settle();
    expect(store.competencyError$()).toBeUndefined();
    expect(store.competency$()?.length).toBeGreaterThan(0);
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
});
