import {
  QuizRequestV1Schema,
  type QuizDetailV1,
  type QuizRequestV1,
} from '@lms/contracts';

/** The five things the short exam form asks for; everything else follows the quiz screen's defaults. */
export interface ExamFormValue {
  readonly title: string;
  readonly timeLimitMinutes: number;
  readonly questionCount: number;
  readonly passPercent: number;
  readonly maxAttempts: number;
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
    description: null,
    quizType: 'FINAL_EXAM',
    selectionMode: 'RANDOM_POOL',
    questionCount: value.questionCount,
    shuffleQuestions: true,
    shuffleOptions: true,
    timeLimitMinutes: value.timeLimitMinutes,
    openAt: null,
    closeAt: null,
    graceSeconds: 0,
    passPercent: value.passPercent,
    scoringMode: 'ALL_OR_NOTHING',
    scoreMethod: 'BEST',
    reviewPolicy: 'AFTER_SUBMIT',
    maxAttempts: value.maxAttempts,
    retakeWaitHours: 0,
    allowRetakeAfterPass: false,
    requireLessonsCompleted: false,
  };
}

/** The values the short form shows for a stored exam. */
export function toExamValue(detail: QuizDetailV1): ExamFormValue {
  const { quiz } = detail;
  return {
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questionCount: quiz.questionCount,
    passPercent: quiz.passPercent,
    maxAttempts: quiz.maxAttempts,
  };
}

/** The stored exam with only the form's five values changed: its other settings are kept. */
export function toUpdatedQuizRequest(
  detail: QuizDetailV1,
  value: ExamFormValue,
): QuizRequestV1 {
  return {
    ...QuizRequestV1Schema.parse(detail.quiz),
    title: value.title.trim(),
    timeLimitMinutes: value.timeLimitMinutes,
    questionCount: value.questionCount,
    passPercent: value.passPercent,
    maxAttempts: value.maxAttempts,
  };
}
