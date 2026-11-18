import {
  checkpointEndpoints,
  CHECKPOINT_STALE_CODE,
  CheckpointAnswerBodySchema,
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
    return Object.values(checkpointEndpoints).some((e) => e === endpoint);
  }

  handle(endpoint: AnyEndpoint, request: FakeRequest): FakeReply | undefined {
    if (!this.answers(endpoint)) return undefined;
    const lessonId = Number(request.params['lessonId'] ?? 1);
    if (endpoint === checkpointEndpoints.checkpoint)
      return ok({ lessonId, questions: this.pick(lessonId) });
    return this.answer(lessonId, request.body);
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
