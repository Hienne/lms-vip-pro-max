import {
  assessmentEndpoints as e,
  SaveQuestionSchema,
  SaveQuizConfigSchema,
  SaveAnswerSchema,
  TakeQuestionSchema,
  type AnyEndpoint,
  type Question,
  type QuizConfig,
  type AttemptSnapshot,
  type AttemptResult,
} from '@lms/contracts';
import type { FakeRequest, FakeReply } from '../backend/fake-backend';
import { envelopeOk, envelopeError } from '../envelope';

const now = () => new Date().toISOString();
const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const fail = (message: string): FakeReply => ({
  status: 200,
  body: envelopeError(
    'MOCK-ASSESSMENT_REFUSED',
    'Không thể thực hiện',
    message,
  ),
});
export const assessmentQuestionFixtures: Question[] = [
  {
    id: 'qs1',
    code: 'CH-CIF-01',
    text: 'Khi khách hàng đổi CCCD, cần làm gì?',
    type: 'single',
    options: [
      { id: 'o1', text: 'Tạo CIF mới' },
      { id: 'o2', text: 'Cập nhật CIF hiện có' },
    ],
    correctOptionIds: ['o2'],
    explanation:
      'Cập nhật giấy tờ trên CIF hiện có và kiểm soát maker-checker.',
    difficulty: 'medium',
    domainId: 'd-cif',
    lessonId: 'ls2',
    competency: 'Quản lý CIF',
    status: 'active',
    usedIn: [{ id: 'q1', title: 'Kiểm tra nghiệp vụ CIF' }],
    updatedAt: '2026-10-19T02:00:00Z',
  },
  {
    id: 'qs2',
    code: 'CH-CIF-02',
    text: 'Những thông tin nào cần kiểm tra trước khi cập nhật CIF?',
    type: 'multiple',
    options: [
      { id: 'a', text: 'Giấy tờ định danh' },
      { id: 'b', text: 'Thông tin khách hàng hiện tại' },
      { id: 'c', text: 'Màu thẻ ATM' },
    ],
    correctOptionIds: ['a', 'b'],
    explanation: 'Đối chiếu giấy tờ định danh và thông tin hiện có.',
    difficulty: 'easy',
    domainId: 'd-cif',
    lessonId: null,
    competency: 'Quản lý CIF',
    status: 'active',
    usedIn: [],
    updatedAt: '2026-10-19T02:00:00Z',
  },
];
export const assessmentQuizFixture: QuizConfig = {
  id: 'q1',
  title: 'Kiểm tra nghiệp vụ CIF',
  courseId: 'c1',
  status: 'published',
  source: 'manual',
  questionIds: ['qs1', 'qs2'],
  questionCount: 2,
  minutes: 15,
  passPct: 80,
  maxAttempts: 3,
  retakeWaitHours: 0,
  shuffleQuestions: true,
  shuffleOptions: true,
  openAt: '2026-01-01T00:00:00Z',
  closeAt: '2027-12-31T00:00:00Z',
  reviewPolicy: 'after_submit',
  version: 1,
};
const course = { id: 'c1', title: 'Nghiệp vụ CIF' };
const summary = {
  attempts: 1,
  left: 2,
  last: 50,
  best: 50,
  passed: false,
  maxAttempts: 3,
  nextAllowedAt: null,
};
/** Fixed computed result: the FE mock never implements scoring or competency calculations. */
export const assessmentResultFixture: AttemptResult = {
  attempt: {
    id: 'at-demo',
    nth: 1,
    score: 50,
    passed: false,
    correctCount: 1,
    total: 2,
    startedAt: '2026-10-19T02:00:00Z',
    submittedAt: '2026-10-19T02:15:00Z',
    minutes: 15,
    autoSubmitted: false,
  },
  quiz: {
    id: 'q1',
    title: assessmentQuizFixture.title,
    courseId: 'c1',
    passPct: 80,
  },
  course,
  summary,
  competency: [{ name: 'Quản lý CIF', correctCount: 1, total: 2 }],
  reviewAllowed: true,
  reviewMessage: null,
  review: assessmentQuestionFixtures.map((q, index) => ({
    number: index + 1,
    questionId: q.id,
    code: q.code,
    text: q.text,
    type: q.type,
    options: q.options,
    mine: index === 0 ? ['o1'] : ['a', 'b'],
    correctOptionIds: q.correctOptionIds,
    ok: index !== 0,
    explanation: q.explanation,
  })),
  courseCompleted: false,
  certificateId: null,
};

/** Stateful mock for proposed FE contracts; browser-memory only, no Java implementation. */
export class AssessmentMock {
  private questions = structuredClone(assessmentQuestionFixtures);
  private quizzes = [structuredClone(assessmentQuizFixture)];
  private readonly attempts = new Map<string, AttemptSnapshot>();
  private readonly sequences = new Map<string, number>();
  answers(endpoint: AnyEndpoint): boolean {
    return Object.values(e).some((item) => item === endpoint);
  }
  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const { params: p, query: q, body } = request;
    const quiz =
      this.quizzes.find((item) => item.id === p['quizId']) ?? this.quizzes[0];
    const key = `${request.token ?? 'demo'}:${quiz.id}`;
    const page = <T>(items: T[]) => {
      const size = Math.min(100, Math.max(1, Number(q['size']) || 20));
      const index = Math.max(0, Number(q['page']) || 0);
      return {
        items: items.slice(index * size, (index + 1) * size),
        page: index,
        size,
        totalElements: items.length,
        totalPages: Math.ceil(items.length / size),
      };
    };
    if (endpoint === e.assessmentOptions)
      return ok({
        courses: [course],
        domains: [{ id: 'd-cif', name: 'Thông tin khách hàng' }],
        lessons: [{ id: 'ls2', title: 'Cập nhật CIF', courseId: 'c1' }],
        competencies: ['Quản lý CIF'],
      });
    if (endpoint === e.questions)
      return ok(
        page(
          this.questions.filter(
            (item) =>
              (!q['q'] ||
                `${item.code} ${item.text}`
                  .toLocaleLowerCase()
                  .includes(q['q'].toLocaleLowerCase())) &&
              [
                'domainId',
                'lessonId',
                'competency',
                'difficulty',
                'status',
              ].every(
                (field) =>
                  !q[field] || item[field as keyof Question] === q[field],
              ),
          ),
        ),
      );
    if (endpoint === e.createQuestion || endpoint === e.saveQuestion) {
      const parsed = SaveQuestionSchema.safeParse(body);
      if (!parsed.success)
        return fail('Kiểm tra nội dung và phương án trả lời.');
      const command = parsed.data;
      if (
        (command.type === 'single' && command.correctOptionIds.length !== 1) ||
        (command.type === 'multiple' && command.correctOptionIds.length < 2) ||
        command.correctOptionIds.some(
          (id) => !command.options.some((o) => o.id === id),
        )
      )
        return fail('Đáp án đúng không hợp lệ.');
      const old = this.questions.find((item) => item.id === p['questionId']);
      const item: Question = {
        ...command,
        id: old?.id ?? crypto.randomUUID(),
        usedIn: old?.usedIn ?? [],
        updatedAt: now(),
      };
      this.questions = [
        ...this.questions.filter((row) => row.id !== item.id),
        item,
      ];
      return ok(item);
    }
    if (endpoint === e.questionStatus || endpoint === e.deleteQuestion) {
      const item = this.questions.find((row) => row.id === p['questionId']);
      if (!item) return fail('Không tìm thấy câu hỏi.');
      if (endpoint === e.deleteQuestion) {
        if (item.usedIn.length)
          return fail(
            'Câu hỏi đã được sử dụng. Hãy ngưng sử dụng thay vì xóa.',
          );
        this.questions = this.questions.filter((row) => row.id !== item.id);
        return ok({ deleted: true });
      }
      const parsed = e.questionStatus.body.safeParse(body);
      if (!parsed.success) return fail('Trạng thái không hợp lệ.');
      item.status = parsed.data.status;
      return ok({ id: item.id, status: item.status });
    }
    if (endpoint === e.quizzes)
      return ok(
        page(
          this.quizzes
            .filter((item) => !q['status'] || item.status === q['status'])
            .map((item) => ({
              ...item,
              courseTitle: course.title,
              attempts: 1,
              passRate: 50,
            })),
        ),
      );
    if (endpoint === e.quiz) return ok(quiz);
    if (endpoint === e.createQuiz || endpoint === e.saveQuiz) {
      const parsed = SaveQuizConfigSchema.safeParse(body);
      if (!parsed.success) return fail('Cấu hình chưa hợp lệ.');
      const { expectedVersion, ...command } = parsed.data;
      const previous = this.quizzes.find((item) => item.id === p['quizId']);
      if (previous && expectedVersion !== previous.version)
        return fail('Cấu hình đã thay đổi. Tải lại trước khi lưu.');
      if (
        Date.parse(command.openAt) >= Date.parse(command.closeAt) ||
        command.questionCount > command.questionIds.length
      )
        return fail('Kiểm tra thời gian mở/đóng và số câu trong ngân hàng.');
      const item = {
        ...command,
        id: previous?.id ?? crypto.randomUUID(),
        version: (previous?.version ?? 0) + 1,
      };
      this.quizzes = [
        ...this.quizzes.filter((row) => row.id !== item.id),
        item,
      ];
      return ok(item);
    }
    if (endpoint === e.quizIntro)
      return ok({
        quiz: { ...quiz, hasMultiple: true },
        course,
        summary,
        block: null,
        pendingAttemptId:
          this.attempts.get(key)?.attempt.status === 'in_progress'
            ? this.attempts.get(key)?.attempt.id
            : null,
        lessonsDone: true,
      });
    if (endpoint === e.currentAttempt) {
      const attempt = this.attempts.get(key);
      return ok(attempt ? { ...attempt, serverNow: now() } : null);
    }
    if (endpoint === e.startAttempt) {
      let attempt = this.attempts.get(key);
      if (!attempt || attempt.attempt.status === 'submitted') {
        attempt = {
          attempt: {
            id: crypto.randomUUID(),
            quizId: quiz.id,
            startedAt: now(),
            deadlineAt: new Date(
              Date.now() + quiz.minutes * 60000,
            ).toISOString(),
            revision: 0,
            answers: {},
            flags: [],
            status: 'in_progress',
          },
          quiz,
          questions: this.questions
            .filter((item) => quiz.questionIds.includes(item.id))
            .map((item) => TakeQuestionSchema.parse(item)),
          serverNow: now(),
        };
        this.attempts.set(key, attempt);
      }
      return ok({ ...attempt, serverNow: now() });
    }
    const snapshot = [...this.attempts.values()].find(
      (item) => item.attempt.id === p['attemptId'],
    );
    if (endpoint === e.saveAnswer) {
      if (!snapshot || snapshot.attempt.status !== 'in_progress')
        return fail('Lượt thi không còn cho phép lưu đáp án.');
      const parsed = SaveAnswerSchema.safeParse(body);
      if (!parsed.success) return fail('Đáp án chưa hợp lệ.');
      const command = parsed.data;
      const questionId = p['questionId'];
      if (command.clientSeq < (this.sequences.get(snapshot.attempt.id) ?? 0))
        return fail('Có thay đổi mới hơn. Hãy tải lại lượt thi.');
      this.sequences.set(snapshot.attempt.id, command.clientSeq);
      snapshot.attempt.answers[questionId] = command.optionIds;
      snapshot.attempt.flags = snapshot.attempt.flags.filter(
        (id) => id !== questionId,
      );
      if (command.flagged) snapshot.attempt.flags.push(questionId);
      snapshot.attempt.revision = command.clientSeq;
      return ok({
        questionId,
        optionIds: command.optionIds,
        flagged: command.flagged,
        revision: command.clientSeq,
        savedAt: now(),
        serverNow: now(),
      });
    }
    if (endpoint === e.submitAttempt) {
      if (!snapshot) return fail('Không tìm thấy lượt thi.');
      snapshot.attempt.status = 'submitted';
      return ok({
        attemptId: snapshot.attempt.id,
        quizId: snapshot.quiz.id,
        status: 'submitted',
        submittedAt: now(),
        autoSubmitted: false,
        resultPath: `/quiz/${snapshot.quiz.id}/result/${snapshot.attempt.id}`,
      });
    }
    if (endpoint === e.attempts)
      return ok({
        quiz,
        summary,
        attempts: page([assessmentResultFixture.attempt]),
      });
    if (endpoint === e.attemptResult) {
      const allowed = quiz.reviewPolicy === 'after_submit';
      return ok({
        ...assessmentResultFixture,
        attempt: { ...assessmentResultFixture.attempt, id: p['attemptId'] },
        quiz,
        reviewAllowed: allowed,
        review: allowed ? assessmentResultFixture.review : null,
        reviewMessage: allowed
          ? null
          : 'Đáp án chưa được phép hiển thị theo chính sách của bài kiểm tra.',
      });
    }
    return undefined;
  }
}
