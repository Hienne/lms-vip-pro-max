import {
  assessmentV1Endpoints,
  learnerQuizEndpoints as e,
  MyAttemptsQuerySchema,
  SaveAnswerBodySchema,
  type AnyEndpoint,
  type AnswerReceipt,
  type AttemptSession,
  type BlockReason,
  type LearnerAttemptResult,
  type LearnerAttemptRow,
  type LearnerAttemptSummary,
  type LearnerQuiz,
  type LearnerQuizCard,
  type LearnerQuizIntro,
  type MyAttemptRow,
  type MyCompetency,
  type QuizSummary,
  type ReviewQuestion,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';
import { courseDetailFixtures } from '../learning/learning.fixtures';

const BOM = String.fromCharCode(0xfeff);
const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const refuse = (code: string, message: string): FakeReply => ({
  status: 200,
  body: envelopeError(code, 'Không thể thực hiện', message),
});

interface SeedQuestion {
  readonly id: number;
  readonly type: 'SINGLE' | 'MULTIPLE';
  readonly content: string;
  readonly options: readonly { id: number; content: string }[];
  /** The key stays in the mock; a learner payload never carries it. */
  readonly correct: readonly number[];
  readonly explanation: string;
  /** Fixed outcome of the canned result, as the server's grading would have said. */
  readonly graded: boolean;
}

interface SeedQuiz {
  readonly quiz: LearnerQuiz;
  readonly courseId: number;
  readonly courseTitle: string;
  readonly lessonId: number | null;
  /** A fixed block the server would report before any attempt (the mock does not track lessons). */
  readonly block: BlockReason | null;
  readonly questions: readonly SeedQuestion[];
}

const question = (
  id: number,
  type: 'SINGLE' | 'MULTIPLE',
  content: string,
  options: readonly string[],
  correct: readonly number[],
  explanation: string,
  graded: boolean,
): SeedQuestion => ({
  id,
  type,
  content,
  options: options.map((text, index) => ({
    id: id * 10 + index + 1,
    content: text,
  })),
  correct: correct.map((index) => id * 10 + index + 1),
  explanation,
  graded,
});

const cifQuestions = [
  question(
    1,
    'SINGLE',
    'Mã CIF dùng để làm gì?',
    [
      'Định danh duy nhất một khách hàng trong hệ thống',
      'Ghi nhận số dư tài khoản',
      'Lưu lịch sử đăng nhập',
      'Đánh số chi nhánh',
    ],
    [0],
    'CIF là mã định danh khách hàng; tài khoản và giao dịch gắn vào CIF.',
    true,
  ),
  question(
    2,
    'MULTIPLE',
    'Những thành phần nào thuộc Core Banking?',
    ['Tiền gửi', 'Tín dụng', 'Sổ cái', 'Trình soạn thảo văn bản'],
    [0, 1, 2],
    'Tiền gửi, tín dụng và sổ cái là các phân hệ nghiệp vụ lõi.',
    true,
  ),
  question(
    3,
    'SINGLE',
    'Maker–checker nhằm mục đích gì?',
    [
      'Tăng tốc độ xử lý',
      'Phân tách nhiệm vụ để kiểm soát chéo',
      'Giảm số lượng người dùng',
      'Tự động duyệt giao dịch',
    ],
    [1],
    'Người lập và người duyệt là hai người khác nhau.',
    false,
  ),
] as const;

const changeQuestions = [
  question(
    4,
    'SINGLE',
    'Một thay đổi cần bắt đầu bằng bước nào?',
    [
      'Lập yêu cầu thay đổi và đánh giá tác động',
      'Triển khai thẳng lên môi trường thật',
      'Báo cho khách hàng',
    ],
    [0],
    'Mọi thay đổi bắt đầu từ một yêu cầu được ghi nhận và đánh giá.',
    true,
  ),
  question(
    5,
    'MULTIPLE',
    'Hồ sơ thay đổi cần có những gì?',
    ['Kế hoạch triển khai', 'Kế hoạch quay lui', 'Kết quả kiểm thử'],
    [0, 1, 2],
    'Cả ba nội dung đều bắt buộc.',
    true,
  ),
] as const;

const baseQuiz: LearnerQuiz = {
  id: 1,
  title: '',
  description: null,
  quizType: 'PRACTICE',
  status: 'PUBLISHED',
  questionCount: 3,
  timeLimitMinutes: 10,
  passPercent: 60,
  maxAttempts: 20,
  retakeWaitHours: 0,
  openAt: null,
  closeAt: null,
  scoreMethod: 'BEST',
  reviewPolicy: 'AFTER_SUBMIT',
  shuffleQuestions: false,
  hasMultipleChoice: true,
};

/** The quiz lesson of a seeded course: the lesson its final exam completes, as the learning mock serves it. */
const quizLessonOf = (courseId: number): number | null =>
  courseDetailFixtures
    .find((d) => d.course.id === courseId)
    ?.chapters.flatMap((c) => c.lessons)
    .find((l) => l.lesson.lessonType === 'quiz')?.lesson.id ?? null;

const SEED: readonly SeedQuiz[] = [
  {
    quiz: {
      ...baseQuiz,
      id: 1,
      title: 'Luyện tập: Tổng quan hệ thống Core Banking',
      description: 'Bộ câu hỏi luyện tập, làm lại nhiều lần.',
      // The canned result gets 2 of 3 right: this quiz fails it, so the retake path can be seen.
      passPercent: 70,
    },
    courseId: 1,
    courseTitle: 'Tổng quan hệ thống Core Banking',
    lessonId: null,
    block: null,
    questions: cifQuestions,
  },
  {
    quiz: {
      ...baseQuiz,
      id: 2,
      title: 'Thi cuối khóa: Tổng quan hệ thống Core Banking',
      description: 'Bài thi cuối khóa, tối đa 2 lượt.',
      quizType: 'FINAL_EXAM',
      timeLimitMinutes: 15,
      passPercent: 70,
      maxAttempts: 2,
      reviewPolicy: 'AFTER_PASS',
    },
    courseId: 1,
    courseTitle: 'Tổng quan hệ thống Core Banking',
    lessonId: quizLessonOf(1),
    block: null,
    // Every question counts as right, so the final exam passes and then reports PASSED.
    questions: cifQuestions.map((q) => ({ ...q, graded: true })),
  },
  {
    quiz: {
      ...baseQuiz,
      id: 3,
      title: 'Thi cuối khóa: Quy trình quản lý thay đổi',
      description: 'Bài thi cuối khóa, cần học xong các bài bắt buộc.',
      quizType: 'FINAL_EXAM',
      questionCount: 2,
      timeLimitMinutes: 15,
      passPercent: 70,
      maxAttempts: 2,
      reviewPolicy: 'AFTER_PASS',
    },
    courseId: 2,
    courseTitle: 'Quy trình quản lý thay đổi (Change Management)',
    lessonId: quizLessonOf(2),
    block: 'LESSONS_REQUIRED',
    questions: changeQuestions,
  },
];

const COMPETENCIES: readonly MyCompetency[] = [
  {
    competencyId: 1,
    code: 'ARCH',
    name: 'Kiến trúc và tổng quan hệ thống',
    totalQuestions: 2,
    correctCount: 2,
    maxScore: 3,
    score: 3,
    percent: 100,
  },
  {
    competencyId: 2,
    code: 'CTRL',
    name: 'Kiểm soát và tuân thủ',
    totalQuestions: 1,
    correctCount: 0,
    maxScore: 1,
    score: 0,
    percent: 0,
  },
];

interface Attempt {
  readonly id: number;
  readonly seed: SeedQuiz;
  readonly no: number;
  readonly startedAt: string;
  readonly deadlineAt: string;
  answers: Map<number, { selected: number[]; flagged: boolean }>;
  submittedAt: string | null;
}

/**
 * The learner quiz API in memory, for `mockBackend`. It follows the server's shapes and refusals
 * but does not grade: a submit returns a canned result (the questions flagged `graded` count as
 * right), because scoring is the backend's job and the mock must not become a second copy of it.
 * One instance is one learner; a page reload resets it.
 */
export class LearnerQuizMock {
  private readonly attempts: Attempt[] = [];
  private nextAttemptId = 1;

  answers(endpoint: AnyEndpoint): boolean {
    return (
      endpoint === assessmentV1Endpoints.courseQuizList ||
      Object.values(e).some((item) => item === endpoint)
    );
  }

  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const { params, query, body } = request;
    const quizId = Number(params['quizId']);
    const attemptId = Number(params['attemptId']);

    if (endpoint === assessmentV1Endpoints.courseQuizList)
      return ok(this.authoring(Number(query['courseId'])));
    if (endpoint === e.courseQuizzes) {
      const cards = SEED.filter(
        (s) => s.courseId === Number(params['courseId']),
      )
        .sort(
          (a, b) =>
            Number(a.quiz.quizType === 'FINAL_EXAM') -
            Number(b.quiz.quizType === 'FINAL_EXAM'),
        )
        .map((s) => this.card(s));
      return ok(cards);
    }
    if (endpoint === e.myAttempts) return ok(this.page(query));
    if (endpoint === e.exportAttempts) return this.csv(query);
    if (endpoint === e.myCompetency) return ok(COMPETENCIES);

    if (
      endpoint === e.quizIntro ||
      endpoint === e.startAttempt ||
      endpoint === e.quizHistory
    ) {
      const seed = SEED.find((s) => s.quiz.id === quizId);
      if (!seed) return refuse('ASSESSMENT-NOT_FOUND', 'Không tìm thấy.');
      if (endpoint === e.quizIntro) return ok(this.intro(seed));
      if (endpoint === e.quizHistory) return ok(this.history(seed));
      return this.start(seed);
    }

    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (!attempt)
      return refuse('ASSESSMENT-NOT_FOUND', 'Không tìm thấy lượt thi.');
    if (endpoint === e.attemptSession) return ok(this.session(attempt));
    if (endpoint === e.saveAnswer) return this.save(attempt, params, body);
    if (endpoint === e.submitAttempt) {
      attempt.submittedAt ??= new Date().toISOString();
      return ok(this.result(attempt));
    }
    if (endpoint === e.attemptResult) {
      if (!attempt.submittedAt)
        return refuse(
          'ASSESSMENT-ATTEMPT_IN_PROGRESS',
          'Lượt thi chưa nộp nên chưa có kết quả.',
        );
      return ok(this.result(attempt));
    }
    return undefined;
  }

  /** The author's list of a course's quizzes (the course editor's picker); every seeded quiz is published. */
  private authoring(courseId: number) {
    const items: QuizSummary[] = SEED.filter(
      (s) => s.courseId === courseId,
    ).map((s) => ({
      id: s.quiz.id,
      courseId: s.courseId,
      title: s.quiz.title,
      quizType: s.quiz.quizType,
      status: 'PUBLISHED',
      selectionMode: 'FIXED',
      questionCount: s.quiz.questionCount,
      timeLimitMinutes: s.quiz.timeLimitMinutes,
      passPercent: s.quiz.passPercent,
      maxAttempts: s.quiz.maxAttempts,
      openAt: null,
      closeAt: null,
      gradedAttempts: this.forQuiz(s).filter((a) => a.submittedAt).length,
      passedAttempts: this.forQuiz(s).filter((a) => a.submittedAt).length,
      poolSize: s.questions.length,
      rowVersion: 0,
      updateTime: null,
    }));
    return {
      items,
      page: 0,
      size: Math.max(items.length, 1),
      totalElements: items.length,
      totalPages: 1,
    };
  }

  private forQuiz(seed: SeedQuiz): Attempt[] {
    return this.attempts.filter((a) => a.seed.quiz.id === seed.quiz.id);
  }

  private running(seed: SeedQuiz): Attempt | undefined {
    return this.forQuiz(seed).find((a) => !a.submittedAt);
  }

  private summary(seed: SeedQuiz): LearnerAttemptSummary {
    const graded = this.forQuiz(seed).filter((a) => a.submittedAt);
    const used = this.forQuiz(seed).length;
    const score = graded.length ? this.score(graded[0].seed) : null;
    const passed = score !== null && score >= seed.quiz.passPercent;
    return {
      maxAttempts: seed.quiz.maxAttempts,
      extraAttempts: 0,
      attemptsUsed: used,
      attemptsLeft: Math.max(0, seed.quiz.maxAttempts - used),
      bestScore: score,
      lastScore: score,
      finalScore: score,
      passed,
      everPassed: passed,
      runningAttemptId: this.running(seed)?.id ?? null,
      lastSubmittedAt: graded.at(-1)?.submittedAt ?? null,
      nextAttemptAt: null,
    };
  }

  private score(seed: SeedQuiz): number {
    const right = seed.questions.filter((q) => q.graded).length;
    return Math.floor((right / seed.questions.length) * 10000) / 100;
  }

  private block(seed: SeedQuiz): {
    canStart: boolean;
    blockReason: BlockReason | null;
  } {
    const summary = this.summary(seed);
    if (summary.runningAttemptId) return { canStart: true, blockReason: null };
    const reason: BlockReason | null =
      seed.block ??
      (summary.attemptsLeft <= 0
        ? 'NO_ATTEMPTS'
        : seed.quiz.quizType === 'FINAL_EXAM' && summary.everPassed
          ? 'PASSED'
          : null);
    return { canStart: reason === null, blockReason: reason };
  }

  private card(seed: SeedQuiz): LearnerQuizCard {
    return {
      quiz: seed.quiz,
      summary: this.summary(seed),
      ...this.block(seed),
      availableAt: null,
      lessonId: seed.lessonId,
    };
  }

  private intro(seed: SeedQuiz): LearnerQuizIntro {
    return {
      quiz: seed.quiz,
      course: { id: seed.courseId, title: seed.courseTitle },
      summary: this.summary(seed),
      ...this.block(seed),
      availableAt: null,
      serverTime: new Date().toISOString(),
    };
  }

  private start(seed: SeedQuiz): FakeReply {
    const running = this.running(seed);
    if (running) return ok(this.session(running));
    const { blockReason } = this.block(seed);
    if (blockReason)
      return refuse(
        `ASSESSMENT-${blockReason}`,
        'Chưa thể bắt đầu bài kiểm tra này.',
      );
    const started = new Date();
    const attempt: Attempt = {
      id: this.nextAttemptId++,
      seed,
      no: this.forQuiz(seed).length + 1,
      startedAt: started.toISOString(),
      deadlineAt: new Date(
        started.getTime() + seed.quiz.timeLimitMinutes * 60000,
      ).toISOString(),
      answers: new Map(),
      submittedAt: null,
    };
    this.attempts.push(attempt);
    return ok(this.session(attempt));
  }

  private session(attempt: Attempt): AttemptSession {
    return {
      attemptId: attempt.id,
      quizId: attempt.seed.quiz.id,
      quizTitle: attempt.seed.quiz.title,
      attemptNo: attempt.no,
      status: attempt.submittedAt ? 'SUBMITTED' : 'IN_PROGRESS',
      startedAt: attempt.startedAt,
      deadlineAt: attempt.deadlineAt,
      serverTime: new Date().toISOString(),
      expired:
        !attempt.submittedAt && Date.parse(attempt.deadlineAt) < Date.now(),
      totalQuestions: attempt.seed.questions.length,
      questions: attempt.seed.questions.map((q, index) => ({
        attemptQuestionId: attempt.id * 100 + q.id,
        displayOrder: index + 1,
        questionType: q.type,
        content: q.content,
        code: `Q${q.id}`,
        options: q.options.map((o) => ({ id: o.id, content: o.content })),
        selectedOptionIds: attempt.answers.get(q.id)?.selected ?? [],
        flagged: attempt.answers.get(q.id)?.flagged ?? false,
      })),
    };
  }

  private save(
    attempt: Attempt,
    params: Readonly<Record<string, string>>,
    body: unknown,
  ): FakeReply {
    if (attempt.submittedAt)
      return refuse('ASSESSMENT-ATTEMPT_CLOSED', 'Lượt thi đã nộp.');
    const parsed = SaveAnswerBodySchema.safeParse(body);
    const questionId = Number(params['attemptQuestionId']) - attempt.id * 100;
    const seed = attempt.seed.questions.find((q) => q.id === questionId);
    if (!parsed.success || !seed)
      return refuse('ASSESSMENT-INVALID_REFERENCE', 'Đáp án không hợp lệ.');
    const previous = attempt.answers.get(questionId) ?? {
      selected: [],
      flagged: false,
    };
    const selected = parsed.data.selectedOptionIds ?? previous.selected;
    if (!selected.every((id) => seed.options.some((o) => o.id === id)))
      return refuse(
        'ASSESSMENT-INVALID_REFERENCE',
        'Phương án không thuộc câu hỏi trong đề.',
      );
    const flagged = parsed.data.flagged ?? previous.flagged;
    attempt.answers.set(questionId, { selected, flagged });
    const receipt: AnswerReceipt = {
      attemptQuestionId: Number(params['attemptQuestionId']),
      selectedOptionIds: selected,
      flagged,
      savedAt: new Date().toISOString(),
      deadlineAt: attempt.deadlineAt,
      serverTime: new Date().toISOString(),
    };
    return ok(receipt);
  }

  private reviewOpen(attempt: Attempt): boolean {
    const policy = attempt.seed.quiz.reviewPolicy;
    return policy === 'AFTER_SUBMIT' || policy === 'AFTER_PASS';
  }

  private result(attempt: Attempt): LearnerAttemptResult {
    const { seed } = attempt;
    const score = this.score(seed);
    const right = seed.questions.filter((q) => q.graded).length;
    const review: ReviewQuestion[] = seed.questions.map((q, index) => ({
      displayOrder: index + 1,
      questionType: q.type,
      content: q.content,
      options: q.options.map((o) => ({
        id: o.id,
        content: o.content,
        correct: q.correct.includes(o.id),
        selected: attempt.answers.get(q.id)?.selected.includes(o.id) ?? false,
      })),
      correct: q.graded,
      points: 1,
      scoreAwarded: q.graded ? 1 : 0,
      explanation: q.explanation,
    }));
    return {
      attemptId: attempt.id,
      quizId: seed.quiz.id,
      quizTitle: seed.quiz.title,
      courseId: seed.courseId,
      attemptNo: attempt.no,
      status: 'SUBMITTED',
      submitType: 'MANUAL',
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      durationSeconds: attempt.submittedAt
        ? Math.round(
            (Date.parse(attempt.submittedAt) - Date.parse(attempt.startedAt)) /
              1000,
          )
        : null,
      totalQuestions: seed.questions.length,
      correctCount: right,
      rawScore: right,
      maxScore: seed.questions.length,
      scorePercent: score,
      passPercent: seed.quiz.passPercent,
      passed: score >= seed.quiz.passPercent,
      summary: this.summary(seed),
      competencies: COMPETENCIES.map((c) => ({
        competencyId: c.competencyId,
        code: c.code,
        name: c.name,
        totalQuestions: c.totalQuestions,
        correctCount: c.correctCount,
        maxScore: c.maxScore,
        score: c.score,
      })),
      reviewPolicy: seed.quiz.reviewPolicy,
      reviewAvailable: this.reviewOpen(attempt),
      review: this.reviewOpen(attempt) ? review : null,
    };
  }

  private row(attempt: Attempt): LearnerAttemptRow {
    const graded = Boolean(attempt.submittedAt);
    const score = this.score(attempt.seed);
    return {
      attemptId: attempt.id,
      attemptNo: attempt.no,
      status: graded ? 'SUBMITTED' : 'IN_PROGRESS',
      submitType: graded ? 'MANUAL' : null,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      durationSeconds: graded
        ? Math.round(
            (Date.parse(attempt.submittedAt as string) -
              Date.parse(attempt.startedAt)) /
              1000,
          )
        : null,
      totalQuestions: attempt.seed.questions.length,
      correctCount: graded
        ? attempt.seed.questions.filter((q) => q.graded).length
        : null,
      scorePercent: graded ? score : null,
      passed: graded ? score >= attempt.seed.quiz.passPercent : null,
    };
  }

  private history(seed: SeedQuiz) {
    return {
      quizId: seed.quiz.id,
      quizTitle: seed.quiz.title,
      summary: this.summary(seed),
      attempts: this.forQuiz(seed).map((a) => this.row(a)),
    };
  }

  private mine(query: Readonly<Record<string, string>>): MyAttemptRow[] {
    const parsed = MyAttemptsQuerySchema.safeParse({
      quizId: query['quizId'] ? Number(query['quizId']) : undefined,
      status: query['status'] || undefined,
    });
    const filter = parsed.success ? parsed.data : {};
    return this.attempts
      .filter(
        (a) =>
          (!filter.quizId || a.seed.quiz.id === filter.quizId) &&
          (!filter.status || this.row(a).status === filter.status),
      )
      .map((a) => ({
        ...this.row(a),
        quizId: a.seed.quiz.id,
        quizTitle: a.seed.quiz.title,
        courseId: a.seed.courseId,
      }))
      .reverse();
  }

  private page(query: Readonly<Record<string, string>>) {
    const rows = this.mine(query);
    const size = Math.min(100, Math.max(1, Number(query['size']) || 20));
    const index = Math.max(0, Number(query['page']) || 0);
    return {
      items: rows.slice(index * size, (index + 1) * size),
      page: index,
      size,
      totalElements: rows.length,
      totalPages: Math.ceil(rows.length / size),
    };
  }

  private csv(query: Readonly<Record<string, string>>): FakeReply {
    const lines = this.mine(query).map((r) =>
      [r.quizTitle, r.attemptNo, r.status, r.submitType ?? '', r.startedAt]
        .map((v) => `"${String(v)}"`)
        .join(','),
    );
    return {
      status: 200,
      body: envelopeOk(null),
      file: new Blob(
        [
          `${BOM}Bài kiểm tra,Lượt,Trạng thái,Cách nộp,Bắt đầu\n${lines.join('\n')}`,
        ],
        { type: 'text/csv;charset=UTF-8' },
      ),
    };
  }
}
