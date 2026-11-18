import {
  checkpointEndpoints,
  CHECKPOINT_STALE_CODE,
  CheckpointAnswerBodySchema,
  competencyReviewEndpoints,
  type CompetencyReview,
  LESSON_TEXT_UNAVAILABLE_CODE,
  selfExplainEndpoints,
  SelfExplainBodySchema,
  type AnyEndpoint,
  type CheckpointQuestion,
} from '@lms/contracts';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { envelopeError, envelopeOk } from '../envelope';

const ok = (data: unknown): FakeReply => ({
  status: 200,
  body: envelopeOk(data),
});
const refuse = (code: string, title: string, message: string): FakeReply => ({
  status: 200,
  body: envelopeError(code, title, message),
});

interface SeedQuestion {
  readonly question: CheckpointQuestion;
  /** The key stays in the mock; a learner payload never carries it. */
  readonly correct: readonly number[];
  readonly explanation: string | null;
}

const VERSION = 1;

const seed = (
  questionId: number,
  questionType: 'SINGLE' | 'MULTIPLE',
  content: string,
  options: readonly string[],
  correctIndexes: readonly number[],
  explanation: string | null,
): SeedQuestion => {
  const optionIds = options.map((_, i) => questionId * 10 + i + 1);
  return {
    question: {
      questionId,
      questionVersion: VERSION,
      questionType,
      content,
      options: options.map((text, i) => ({ id: optionIds[i], content: text })),
    },
    correct: correctIndexes.map((i) => optionIds[i]),
    explanation,
  };
};

/** The flashcards an instructor published, as the mock's lessons share them. */
const POOL: readonly SeedQuestion[] = [
  seed(
    301,
    'SINGLE',
    'Hạn mức giao dịch được kiểm soát ở bước nào?',
    [
      'Khi khởi tạo giao dịch',
      'Chỉ kiểm tra cuối ngày',
      'Không cần kiểm tra',
      'Do khách hàng tự xác nhận',
    ],
    [0],
    'Hạn mức được kiểm soát ngay khi khởi tạo giao dịch, trước khi chuyển sang duyệt.',
  ),
  seed(
    302,
    'MULTIPLE',
    'Chọn các thông tin bắt buộc khi mở tài khoản.',
    ['Giấy tờ định danh', 'Sở thích cá nhân', 'Địa chỉ liên hệ'],
    [0, 2],
    null,
  ),
  seed(
    303,
    'SINGLE',
    'Bút toán điều chỉnh phải có gì kèm theo?',
    [
      'Lý do và người phê duyệt',
      'Chỉ cần số tiền',
      'Chữ ký của khách hàng',
      'Không cần gì',
    ],
    [0],
    'Mọi bút toán điều chỉnh cần lý do và người phê duyệt để truy vết.',
  ),
  seed(
    304,
    'SINGLE',
    'Sao kê tài khoản được lập theo kỳ nào?',
    ['Theo ngày làm việc', 'Theo giờ', 'Theo tuần lễ'],
    [0],
    'Sao kê chốt theo ngày làm việc của hệ thống.',
  ),
];

/** How many questions a lesson shows at most; the same limit the backend uses. */
const MAX_QUESTIONS = 3;

/**
 * The learning loop as the mock backend answers it while the real one lacks it: the in-lesson
 * checkpoint today. A lesson whose id divides by five has no published flashcard, so the card stays
 * hidden there; the others show up to three questions, missed ones first, and grade like the server.
 */
export class LearningLoopMock {
  /** Every checkpoint answer, as the server would store it. */
  private readonly checkpointAnswers: {
    readonly lessonId: number;
    readonly questionId: number;
    readonly correct: boolean;
  }[] = [];

  answers(endpoint: AnyEndpoint): boolean {
    return (
      endpoint === selfExplainEndpoints.selfExplain ||
      endpoint === competencyReviewEndpoints.review ||
      Object.values(checkpointEndpoints).some((e) => e === endpoint)
    );
  }

  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const lessonId = Number(request.params['lessonId'] ?? 1);
    if (endpoint === competencyReviewEndpoints.review)
      return ok(this.review(request.query));
    if (endpoint === selfExplainEndpoints.selfExplain)
      return this.selfExplain(lessonId, request.body);
    if (endpoint === checkpointEndpoints.checkpoint)
      return ok({ lessonId, questions: this.pick(lessonId) });
    return this.answer(lessonId, request.body);
  }

  /**
   * The weak competencies of the mock's `myCompetency` (CTRL 0%, OPS 33.33%), weakest first, with
   * lessons of the first seeded course. A lesson the learner has since answered right twice in a
   * row at the quick questions drops out, as on the server.
   */
  private review(query: Record<string, string>): CompetencyReview[] {
    const at = new Date().toISOString();
    const lesson = (
      lessonId: number,
      lessonTitle: string,
      missedCount: number,
    ) => ({
      courseId: 1,
      courseTitle: 'Tổng quan hệ thống Core Banking',
      lessonId,
      lessonTitle,
      missedCount,
      lastMissedAt: at,
    });
    const mastered = (lessonId: number): boolean => {
      const last = this.checkpointAnswers
        .filter((a) => a.lessonId === lessonId)
        .slice(-2);
      return last.length === 2 && last.every((a) => a.correct);
    };
    const all: CompetencyReview[] = [
      {
        competencyId: 2,
        name: 'Kiểm soát và tuân thủ',
        percent: 0,
        lessons: [
          lesson(3, 'Luồng giao dịch từ kênh đến sổ cái', 3),
          lesson(1, 'Kiến trúc tổng thể hệ thống Core Banking', 1),
        ],
      },
      {
        competencyId: 3,
        name: 'Vận hành và quy trình',
        percent: 33.33,
        lessons: [lesson(2, 'Mô hình dữ liệu khách hàng (CIF)', 2)],
      },
    ];
    const only = query['competencyId'];
    return all
      .filter((row) => only === undefined || row.competencyId === Number(only))
      .map((row) => ({
        ...row,
        lessons: row.lessons.filter((l) => !mastered(l.lessonId)),
      }))
      .slice(0, Number(query['limit'] ?? 3));
  }

  /** Streams the canned three sections; the refusals come before any event, as the server's do. */
  private selfExplain(lessonId: number, body: unknown): FakeReply {
    if (!SelfExplainBodySchema.safeParse(body).success)
      return refuse(
        'CORE-VALIDATION_FAILED',
        'Dữ liệu chưa hợp lệ',
        'Hãy viết từ 50 đến 1500 ký tự.',
      );
    // Lessons without a quick question have no text to compare with either.
    if (lessonId % 5 === 0)
      return refuse(
        LESSON_TEXT_UNAVAILABLE_CODE,
        'Chưa có nội dung bài học',
        'Bài học này chưa có nội dung để đối chiếu. Bạn thử lại sau nhé.',
      );
    const answer = [
      '**Bạn đã nắm được**',
      '- Ý chính của bài và mục đích của nó [1].',
      '',
      '**Còn thiếu**',
      '- Các bước thực hiện theo đúng thứ tự [1].',
      '',
      '**Cần xem lại (có thể hiểu chưa đúng)**',
      '- Điều kiện áp dụng: bài nêu rõ khi nào được dùng [1].',
    ].join('\n');
    return {
      status: 200,
      body: envelopeOk(null),
      events: [
        { type: 'conversation', conversationId: 1 },
        { type: 'delta', text: answer },
        {
          type: 'done',
          answer,
          citations: [
            {
              n: 1,
              documentId: 0,
              fileName: 'Bài học',
              page: null,
              lineStart: 0,
              lineEnd: 0,
              snippet: 'Nội dung bài học được trích từ khóa học.',
              lesson: {
                courseId: 1,
                courseTitle: 'Khóa học',
                revisionId: 1,
                chapterTitle: 'Chương 1',
                lessonId,
                lessonTitle: `Bài ${lessonId}`,
                blockId: 1,
                url: `/lesson/1/${lessonId}`,
              },
            },
          ],
        },
      ],
    };
  }

  private candidates(lessonId: number): readonly SeedQuestion[] {
    if (!Number.isFinite(lessonId) || lessonId % 5 === 0) return [];
    const start = Math.abs(lessonId) % POOL.length;
    return POOL.map((_, i) => POOL[(start + i) % POOL.length]);
  }

  /** Unanswered first, then missed, then the rest, as the server orders them. */
  private pick(lessonId: number): CheckpointQuestion[] {
    const mine = this.checkpointAnswers.filter((a) => a.lessonId === lessonId);
    const rank = (s: SeedQuestion): number => {
      const given = mine.filter((a) => a.questionId === s.question.questionId);
      if (given.length === 0) return 0;
      return given.some((a) => !a.correct) ? 1 : 2;
    };
    return this.candidates(lessonId)
      .map((s, index) => ({ s, index, rank: rank(s) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, MAX_QUESTIONS)
      .map(({ s }) => s.question);
  }

  private answer(lessonId: number, body: unknown): FakeReply {
    const parsed = CheckpointAnswerBodySchema.safeParse(body);
    if (!parsed.success)
      return refuse(
        'CORE-VALIDATION_FAILED',
        'Thông tin chưa hợp lệ',
        'Dữ liệu đầu vào không hợp lệ.',
      );
    const { questionId, questionVersion, optionIds } = parsed.data;
    const seeded = this.candidates(lessonId).find(
      (s) => s.question.questionId === questionId,
    );
    if (!seeded || questionVersion !== seeded.question.questionVersion)
      return refuse(
        CHECKPOINT_STALE_CODE,
        'Câu hỏi đã thay đổi',
        'Câu hỏi nhanh đã thay đổi hoặc không còn dùng cho bài học này. Hãy tải lại các câu hỏi.',
      );
    const chosen = new Set(optionIds);
    const correct =
      chosen.size === seeded.correct.length &&
      seeded.correct.every((id) => chosen.has(id));
    this.checkpointAnswers.push({ lessonId, questionId, correct });
    return ok({
      correct,
      correctOptionIds: [...seeded.correct],
      explanation: seeded.explanation,
    });
  }
}
