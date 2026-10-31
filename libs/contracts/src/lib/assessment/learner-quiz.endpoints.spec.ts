import { toUrl } from '../http/endpoint';
import { assessmentV1Endpoints } from './assessment-v1.endpoints';
import { capturedLearnerQuiz as captured } from './learner-quiz.captured';
import { learnerQuizEndpoints as e } from './learner-quiz.endpoints';
import {
  AttemptSessionSchema,
  LearnerAttemptResultSchema,
  LearnerQuizIntroSchema,
} from './learner-quiz.schema';

describe('learnerQuizEndpoints', () => {
  const responses = {
    courseQuizzes: captured.courseQuizzes,
    quizIntro: captured.introOpen,
    startAttempt: captured.startAttempt,
    quizHistory: captured.quizHistory,
    myAttempts: captured.myAttempts,
    attemptSession: captured.attemptSession,
    saveAnswer: captured.saveAnswer,
    submitAttempt: captured.attemptResult,
    attemptResult: captured.attemptResult,
    myCompetency: captured.myCompetency,
  } as const;

  it.each(Object.entries(responses))(
    'parses the response captured from the backend for %s',
    (key, data) => {
      const endpoint = e[key as keyof typeof responses];
      expect(endpoint.response.safeParse(data).success).toBe(true);
    },
  );

  it('parses an intro the server blocks, with its reason', () => {
    const intro = LearnerQuizIntroSchema.parse(captured.introBlocked);
    expect(intro.canStart).toBe(false);
    expect(intro.blockReason).toBe('LESSONS_REQUIRED');
  });

  it('keeps the answer key out of a session and shows it only in a review', () => {
    const session = AttemptSessionSchema.parse(captured.startAttempt);
    expect(JSON.stringify(session)).not.toMatch(/correct|explanation/);
    const result = LearnerAttemptResultSchema.parse(captured.attemptResult);
    expect(result.review?.[0].options.some((o) => o.correct)).toBe(true);
  });

  it('refuses a response with the wrong shape', () => {
    const withoutReason = { ...captured.introBlocked, blockReason: undefined };
    expect(e.quizIntro.response.safeParse(withoutReason).success).toBe(false);
    expect(
      e.quizIntro.response.safeParse({
        ...captured.introBlocked,
        blockReason: 'SOMETHING_NEW',
      }).success,
    ).toBe(false);
    expect(
      e.attemptSession.response.safeParse({
        ...captured.attemptSession,
        questions: [{ attemptQuestionId: '1' }],
      }).success,
    ).toBe(false);
    expect(e.myCompetency.response.safeParse({}).success).toBe(false);
  });

  it('builds the paths of the backend', () => {
    expect(toUrl(e.courseQuizzes, { courseId: 7 })).toBe(
      '/api/v1/me/courses/7/quizzes',
    );
    expect(toUrl(e.quizIntro, { quizId: 4 })).toBe('/api/v1/me/quizzes/4');
    expect(toUrl(e.saveAnswer, { attemptId: 3, attemptQuestionId: 9 })).toBe(
      '/api/v1/me/quiz-attempts/3/questions/9',
    );
    expect(e.saveAnswer.method).toBe('patch');
    expect(e.exportAttempts.responseType).toBe('blob');
  });

  it('accepts a partial save: a choice, a flag, or both', () => {
    const body = e.saveAnswer.body;
    expect(body.safeParse({ selectedOptionIds: [] }).success).toBe(true);
    expect(body.safeParse({ flagged: true }).success).toBe(true);
    expect(body.safeParse({ selectedOptionIds: ['a'] }).success).toBe(false);
  });
});

describe('assessmentV1Endpoints.courseQuizList', () => {
  const summary = {
    id: 2,
    courseId: 1,
    title: 'Thi cuối khóa',
    quizType: 'FINAL_EXAM',
    status: 'PUBLISHED',
    selectionMode: 'RANDOM_POOL',
    questionCount: 6,
    timeLimitMinutes: 15,
    passPercent: 70,
    maxAttempts: 2,
    openAt: null,
    closeAt: null,
    gradedAttempts: 3,
    passedAttempts: 1,
    poolSize: 8,
    rowVersion: 0,
    updateTime: '2026-10-31T09:00:00.123456Z',
  };
  const page = {
    items: [summary],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  };

  it('parses a page of quiz summaries and requires the course in the query', () => {
    const endpoint = assessmentV1Endpoints.courseQuizList;
    expect(endpoint.response.safeParse(page).success).toBe(true);
    expect(endpoint.query.safeParse({ courseId: 1 }).success).toBe(true);
    expect(endpoint.query.safeParse({}).success).toBe(false);
    expect(
      endpoint.response.safeParse({
        ...page,
        items: [{ ...summary, status: 'ARCHIVED' }],
      }).success,
    ).toBe(false);
  });
});
