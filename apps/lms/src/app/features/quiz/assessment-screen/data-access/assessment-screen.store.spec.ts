import { TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import {
  assessmentEndpoints,
  type AnyEndpoint,
  type AttemptSnapshot,
} from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { AssessmentScreenStore } from './assessment-screen.store';

const now = '2026-10-20T08:00:00Z';
const snapshot: AttemptSnapshot = {
  attempt: {
    id: 'attempt1',
    quizId: 'q1',
    startedAt: now,
    deadlineAt: '2026-10-20T08:02:00Z',
    revision: 4,
    answers: {},
    flags: [],
    status: 'in_progress',
  },
  quiz: { id: 'q1', title: 'Kiểm tra CIF', courseId: 'c1', passPct: 80 },
  questions: [
    {
      id: 'a',
      code: 'A',
      text: 'Câu A',
      type: 'single',
      options: [
        { id: 'a1', text: 'A1' },
        { id: 'a2', text: 'A2' },
      ],
    },
    {
      id: 'b',
      code: 'B',
      text: 'Câu B',
      type: 'multiple',
      options: [
        { id: 'b1', text: 'B1' },
        { id: 'b2', text: 'B2' },
      ],
    },
  ],
  serverNow: now,
};
describe('AssessmentScreenStore attempt lifecycle', () => {
  let offline = false;
  const calls: {
    endpoint: AnyEndpoint;
    input?: { params?: Record<string, string>; body?: unknown };
  }[] = [];
  const nav = {
    url: '/quiz/q1/take',
    events: new Subject(),
    navigate: vi.fn(),
    navigateByUrl: vi.fn(),
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    calls.length = 0;
    offline = false;
    nav.navigateByUrl.mockReset();
    TestBed.configureTestingModule({
      providers: [
        AssessmentScreenStore,
        { provide: Router, useValue: nav },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'q1' })) },
        },
        { provide: Dialog, useValue: { openDialogs: [] } },
        { provide: Toaster, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: EndpointClient,
          useValue: {
            call: (
              endpoint: AnyEndpoint,
              input?: { params?: Record<string, string>; body?: unknown },
            ) => {
              calls.push({ endpoint, input });
              if (endpoint === assessmentEndpoints.currentAttempt)
                return of(structuredClone(snapshot));
              if (endpoint === assessmentEndpoints.assessmentOptions)
                return of({
                  courses: [],
                  domains: [],
                  lessons: [],
                  competencies: [],
                });
              if (endpoint === assessmentEndpoints.saveAnswer) {
                if (offline)
                  return throwError(() => new HttpErrorResponse({ status: 0 }));
                return of({
                  questionId: input?.params?.['questionId'],
                  revision: 5,
                  serverNow: now,
                  savedAt: now,
                  optionIds: [],
                  flagged: false,
                });
              }
              if (endpoint === assessmentEndpoints.submitAttempt)
                return of({
                  attemptId: 'attempt1',
                  quizId: 'q1',
                  status: 'submitted',
                  submittedAt: now,
                  autoSubmitted: true,
                  resultPath: '/quiz/q1/result/attempt1',
                });
              throw new Error(`Unexpected endpoint ${endpoint.path}`);
            },
          },
        },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  async function settle() {
    TestBed.tick();
    await Promise.resolve();
    TestBed.tick();
  }
  it('starts from the server deadline and does not submit when the resource first arrives', async () => {
    const store = TestBed.inject(AssessmentScreenStore);
    await settle();
    expect(store.seconds$()).toBe(120);
    expect(
      calls.some((c) => c.endpoint === assessmentEndpoints.submitAttempt),
    ).toBe(false);
    vi.advanceTimersByTime(1000);
    await settle();
    expect(store.seconds$()).toBe(119);
  });
  it('submits once when the server deadline expires, and releases the clock', async () => {
    const store = TestBed.inject(AssessmentScreenStore);
    await settle();
    vi.advanceTimersByTime(120000);
    await settle();
    expect(
      calls.filter((c) => c.endpoint === assessmentEndpoints.submitAttempt),
    ).toHaveLength(1);
    expect(nav.navigateByUrl).toHaveBeenCalledWith('/quiz/q1/result/attempt1');
    vi.advanceTimersByTime(3000);
    await settle();
    expect(
      calls.filter((c) => c.endpoint === assessmentEndpoints.submitAttempt),
    ).toHaveLength(1);
    expect(store.snapshot$()?.attempt.status).toBe('submitted');
  });
  it('continues the answer sequence after a resumed server revision', async () => {
    const store = TestBed.inject(AssessmentScreenStore);
    await settle();
    store.chooseOption('a', 'a1', true, false);
    await settle();
    expect(
      calls.find((c) => c.endpoint === assessmentEndpoints.saveAnswer)?.input
        ?.body,
    ).toMatchObject({ clientSeq: 5, optionIds: ['a1'] });
    expect(store.snapshot$()?.attempt.answers['a']).toEqual(['a1']);
  });
  it('keeps failed answers and retries them in sequence before submitting', async () => {
    const store = TestBed.inject(AssessmentScreenStore);
    await settle();
    offline = true;
    store.chooseOption('a', 'a1', true, false);
    await settle();
    expect(store.answerError$()).toBeDefined();
    expect(store.hasUnsavedAnswers$()).toBe(true);
    expect(store.snapshot$()?.attempt.answers['a']).toEqual(['a1']);
    offline = false;
    await store.submit(true);
    await settle();
    const recent = calls.filter(
      (c) =>
        c.endpoint === assessmentEndpoints.saveAnswer ||
        c.endpoint === assessmentEndpoints.submitAttempt,
    );
    expect(recent.map((c) => c.endpoint)).toEqual([
      assessmentEndpoints.saveAnswer,
      assessmentEndpoints.saveAnswer,
      assessmentEndpoints.submitAttempt,
    ]);
    expect(store.hasUnsavedAnswers$()).toBe(false);
  });
});
