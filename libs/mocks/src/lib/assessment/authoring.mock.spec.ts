import {
  assessmentV1Endpoints as api,
  authV1Endpoints,
  courseEndpoints,
  programAssessmentEndpoints,
  EnvelopeSchema,
  type AnyEndpoint,
  type QuizRequestV1,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('quiz authoring rules on the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      call(authV1Endpoints.login, {
        body: { username: 'quantri', password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (
    endpoint: AnyEndpoint,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: endpoint === authV1Endpoints.login ? null : token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  // Course 1 already owns the seeded final exam (quiz 2); quiz 1 is its practice quiz.
  const request = (
    courseId: number,
    quizType: QuizRequestV1['quizType'],
    questionCount = 2,
  ): QuizRequestV1 => ({
    courseId,
    title: 'Bài thi mới',
    description: null,
    quizType,
    selectionMode: 'RANDOM_POOL',
    questionCount,
    shuffleQuestions: true,
    shuffleOptions: true,
    timeLimitMinutes: 15,
    openAt: null,
    closeAt: null,
    graceSeconds: 0,
    passPercent: 70,
    scoringMode: 'ALL_OR_NOTHING',
    scoreMethod: 'BEST',
    reviewPolicy: 'AFTER_SUBMIT',
    maxAttempts: 3,
    retakeWaitHours: 0,
    allowRetakeAfterPass: false,
    requireLessonsCompleted: false,
  });

  const refusal = (reply: FakeReply) => {
    const envelope = EnvelopeSchema.parse(reply.body);
    return { status: envelope.status, code: envelope.messageCode };
  };

  it('refuses a second FINAL_EXAM for a course that already has one', () => {
    const reply = call(api.createQuiz, { body: request(1, 'FINAL_EXAM') });
    expect(refusal(reply)).toEqual({
      status: 'ERROR',
      code: 'ASSESSMENT-DUPLICATE',
    });
    expect(EnvelopeSchema.parse(reply.body).message).toBe(
      'Khóa học đã có bài thi cuối khóa.',
    );
  });

  it('allows a practice quiz next to the final exam', () => {
    const reply = call(api.createQuiz, { body: request(1, 'PRACTICE') });
    expect(refusal(reply).status).toBe('SUCCESS');
  });

  it('refuses turning another quiz of the course into a second FINAL_EXAM', () => {
    const reply = call(api.updateQuiz, {
      params: { id: '1' },
      query: { expectedVersion: '0' },
      body: request(1, 'FINAL_EXAM'),
    });
    expect(refusal(reply).code).toBe('ASSESSMENT-DUPLICATE');
  });

  it('lets the existing final exam be updated as itself', () => {
    const reply = call(api.updateQuiz, {
      params: { id: '2' },
      query: { expectedVersion: '0' },
      body: request(1, 'FINAL_EXAM'),
    });
    expect(refusal(reply).status).toBe('SUCCESS');
  });

  it('refuses a pool question from another program', () => {
    const created = call(api.createQuiz, { body: request(1, 'PRACTICE') });
    const quiz = (created.body.data as { quiz: { id: number } }).quiz;
    const reply = call(api.replacePool, {
      params: { id: String(quiz.id) },
      query: { expectedVersion: '0' },
      body: { items: [{ questionId: 999999, sortNo: 0, points: null }] },
    });
    expect(refusal(reply).code).toBe('CORE-VALIDATION_FAILED');
  });

  it('refuses publishing a quiz with fewer active pool questions than its count', () => {
    const created = call(api.createQuiz, {
      body: request(1, 'PRACTICE', 5),
    });
    const quiz = (created.body.data as { quiz: { id: number } }).quiz;
    const reply = call(api.publishQuiz, {
      params: { id: String(quiz.id) },
      body: { expectedVersion: 0 },
    });
    expect(refusal(reply).code).toBe('ASSESSMENT-QUIZ_NOT_READY');
  });

  describe('for a course created in this session', () => {
    const createdCourse = () => {
      const reply = call(courseEndpoints.createCourse, {
        body: {
          ownerOrgId: 1,
          code: 'AUTH-NEW-1',
          draft: {
            title: 'Khóa mới tạo',
            programId: 2,
            level: 'basic',
            defaultRequirement: 'mandatory',
            objectives: [],
            chapters: [],
          },
        },
      });
      return (reply.body.data as { course: { id: number } }).course.id;
    };

    it('lets its manager create a final exam for it', () => {
      const reply = call(api.createQuiz, {
        body: request(createdCourse(), 'FINAL_EXAM'),
      });
      expect(refusal(reply).status).toBe('SUCCESS');
    });

    it('lets its manager read the program bank through the course', () => {
      const courseId = createdCourse();
      const reply = call(programAssessmentEndpoints.questions, {
        query: { programId: '2', courseId: String(courseId), status: 'ACTIVE' },
      });
      expect(refusal(reply).status).toBe('SUCCESS');
    });
  });
});
