import {
  QuizRequestV1Schema,
  type QuizDetailV1,
  type QuizRequestV1,
  type QuestionSummaryV1,
} from '@lms/contracts';

export type ExamQuestion = Pick<
  QuestionSummaryV1,
  'id' | 'code' | 'contentPreview' | 'questionType' | 'difficulty'
>;

/** The settings editable directly from the course editor. */
export interface ExamFormValue {
  readonly description?: string | null;
  readonly selectionMode?: QuizRequestV1['selectionMode'];
  readonly shuffleQuestions?: boolean;
  readonly shuffleOptions?: boolean;
  readonly openAt?: string | null;
  readonly closeAt?: string | null;
  readonly graceSeconds?: number;
  readonly scoringMode?: QuizRequestV1['scoringMode'];
  readonly scoreMethod?: QuizRequestV1['scoreMethod'];
  readonly reviewPolicy?: QuizRequestV1['reviewPolicy'];
  readonly requireLessonsCompleted?: boolean;
  readonly questionIds?: readonly number[];
  readonly title: string;
  readonly timeLimitMinutes: number;
  readonly questionCount: number;
  readonly passPercent: number;
  readonly maxAttempts: number;
  readonly retakeWaitHours: number;
  readonly allowRetakeAfterPass: boolean;
}

/** A quiz pool takes at most this many questions (backend `MAX_POOL_SIZE`). */
export const POOL_LIMIT = 2000;
const POOL_PAGE_SIZE = 100;
export const POOL_PAGES = POOL_LIMIT / POOL_PAGE_SIZE;
export { POOL_PAGE_SIZE };

export const EXAM_LIMITS = {
  title: 255,
  timeLimitMinutes: { min: 1, max: 240 },
  questionCount: { min: 1, max: 200 },
  passPercent: { min: 1, max: 100 },
  maxAttempts: { min: 1, max: 20 },
  retakeWaitHours: { min: 0, max: 720 },
} as const;

/** The form's starting values for a new exam: 15 minutes, 70 %, 3 attempts, up to 10 questions. */
export function newExamValue(
  courseTitle: string,
  activeBank: number | undefined,
): ExamFormValue {
  return {
    title: courseTitle ? `Thi cuối khóa: ${courseTitle}` : 'Thi cuối khóa',
    timeLimitMinutes: 15,
    questionCount: Math.max(1, Math.min(10, activeBank ?? 10)),
    passPercent: 70,
    maxAttempts: 3,
    retakeWaitHours: 0,
    allowRetakeAfterPass: false,
  };
}

/** A new final exam: a random pool over the program's bank, with the quiz screen's defaults. */
export function toNewQuizRequest(
  courseId: number,
  value: ExamFormValue,
): QuizRequestV1 {
  return {
    courseId,
    title: value.title.trim(),
    description: value.description?.trim() || null,
    quizType: 'FINAL_EXAM',
    selectionMode: value.selectionMode ?? 'RANDOM_POOL',
    questionCount: value.questionCount,
    shuffleQuestions: value.shuffleQuestions ?? true,
    shuffleOptions: value.shuffleOptions ?? true,
    timeLimitMinutes: value.timeLimitMinutes,
    openAt: value.openAt ? new Date(value.openAt).toISOString() : null,
    closeAt: value.closeAt ? new Date(value.closeAt).toISOString() : null,
    graceSeconds: value.graceSeconds ?? 0,
    passPercent: value.passPercent,
    scoringMode: value.scoringMode ?? 'ALL_OR_NOTHING',
    scoreMethod: value.scoreMethod ?? 'BEST',
    reviewPolicy: value.reviewPolicy ?? 'AFTER_SUBMIT',
    maxAttempts: value.maxAttempts,
    retakeWaitHours: value.retakeWaitHours,
    allowRetakeAfterPass: value.allowRetakeAfterPass,
    requireLessonsCompleted: value.requireLessonsCompleted ?? false,
  };
}

/** The values the short form shows for a stored exam. */
export function toExamValue(detail: QuizDetailV1): ExamFormValue {
  const { quiz } = detail;
  return {
    ...QuizRequestV1Schema.parse(quiz),
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questionCount: quiz.questionCount,
    passPercent: quiz.passPercent,
    maxAttempts: quiz.maxAttempts,
    retakeWaitHours: quiz.retakeWaitHours,
    allowRetakeAfterPass: quiz.allowRetakeAfterPass,
  };
}

/** Keep settings that are only editable in the full quiz configuration. */
export function toUpdatedQuizRequest(
  detail: QuizDetailV1,
  value: ExamFormValue,
): QuizRequestV1 {
  return {
    ...toNewQuizRequest(detail.quiz.courseId, {
      ...toExamValue(detail),
      ...value,
    }),
  };
}
