import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageSchema } from '../http/page';

/**
 * The learner side of the backend's Assessment module (`/api/v1/me/…`). Each schema mirrors a
 * record of `AssessmentViews` field by field; ids are numbers, scores are percentages, and the
 * server decides every rule (attempts left, open and close windows, scoring).
 */
const Id = z.number().int();

export const LearnerQuizTypeSchema = z.enum(['PRACTICE', 'FINAL_EXAM']);
export type LearnerQuizType = z.infer<typeof LearnerQuizTypeSchema>;

export const LearnerReviewPolicySchema = z.enum([
  'NEVER',
  'AFTER_SUBMIT',
  'AFTER_PASS',
  'AFTER_CLOSE',
]);
export type LearnerReviewPolicy = z.infer<typeof LearnerReviewPolicySchema>;

export const LearnerAttemptStatusSchema = z.enum([
  'IN_PROGRESS',
  'SUBMITTED',
  'AUTO_SUBMITTED',
  'VOIDED',
]);
export type LearnerAttemptStatus = z.infer<typeof LearnerAttemptStatusSchema>;

export const LearnerSubmitTypeSchema = z.enum([
  'MANUAL',
  'TIMEOUT',
  'QUIZ_CLOSED',
  'ADMIN',
]);
export type LearnerSubmitType = z.infer<typeof LearnerSubmitTypeSchema>;

export const LearnerQuestionTypeSchema = z.enum(['SINGLE', 'MULTIPLE']);
export type LearnerQuestionType = z.infer<typeof LearnerQuestionTypeSchema>;

/** Why the caller cannot start a new attempt now; the screen words each one. */
export const BlockReasonSchema = z.enum([
  'NOT_OPEN',
  'CLOSED',
  'NOT_READY',
  'LESSONS_REQUIRED',
  'PASSED',
  'NO_ATTEMPTS',
  'WAIT',
]);
export type BlockReason = z.infer<typeof BlockReasonSchema>;

/** `LearnerQuiz`: the public configuration of a quiz; never the questions or the answer key. */
export const LearnerQuizSchema = z.object({
  id: Id,
  title: z.string(),
  description: z.string().nullable(),
  quizType: LearnerQuizTypeSchema,
  status: z.string(),
  questionCount: z.number().int(),
  timeLimitMinutes: z.number().int(),
  passPercent: z.number(),
  maxAttempts: z.number().int(),
  retakeWaitHours: z.number().int(),
  openAt: BackendDateTimeSchema.nullable(),
  closeAt: BackendDateTimeSchema.nullable(),
  scoreMethod: z.enum(['BEST', 'LAST']),
  reviewPolicy: LearnerReviewPolicySchema,
  shuffleQuestions: z.boolean(),
  hasMultipleChoice: z.boolean(),
});
export type LearnerQuiz = z.infer<typeof LearnerQuizSchema>;

/** `AttemptSummary`: the caller's attempts of one quiz, combined by the quiz's score method. */
export const LearnerAttemptSummarySchema = z.object({
  maxAttempts: z.number().int(),
  extraAttempts: z.number().int(),
  attemptsUsed: z.number().int(),
  attemptsLeft: z.number().int(),
  bestScore: z.number().nullable(),
  lastScore: z.number().nullable(),
  finalScore: z.number().nullable(),
  passed: z.boolean(),
  everPassed: z.boolean(),
  runningAttemptId: Id.nullable(),
  lastSubmittedAt: BackendDateTimeSchema.nullable(),
  nextAttemptAt: BackendDateTimeSchema.nullable(),
});
export type LearnerAttemptSummary = z.infer<typeof LearnerAttemptSummarySchema>;

export const LearnerCourseRefSchema = z.object({
  id: Id,
  title: z.string(),
});

/** `QuizIntro`: the screen before a quiz. `canStart` and `blockReason` are the server's call. */
export const LearnerQuizIntroSchema = z.object({
  quiz: LearnerQuizSchema,
  course: LearnerCourseRefSchema,
  summary: LearnerAttemptSummarySchema,
  canStart: z.boolean(),
  blockReason: BlockReasonSchema.nullable(),
  availableAt: BackendDateTimeSchema.nullable(),
  serverTime: BackendDateTimeSchema,
});
export type LearnerQuizIntro = z.infer<typeof LearnerQuizIntroSchema>;

/** `LearnerQuizCard`: one quiz of a course in the learner's list, with the lesson that holds it. */
export const LearnerQuizCardSchema = z.object({
  quiz: LearnerQuizSchema,
  summary: LearnerAttemptSummarySchema,
  canStart: z.boolean(),
  blockReason: BlockReasonSchema.nullable(),
  availableAt: BackendDateTimeSchema.nullable(),
  lessonId: Id.nullable(),
});
export type LearnerQuizCard = z.infer<typeof LearnerQuizCardSchema>;

const OptionTextSchema = z.object({ id: Id, content: z.string() });

/** `SessionQuestion`: a dealt question. It carries no answer key and no explanation. */
export const SessionQuestionSchema = z.object({
  attemptQuestionId: Id,
  displayOrder: z.number().int(),
  questionType: LearnerQuestionTypeSchema,
  content: z.string(),
  /** The question's code in the bank (`questions.code`), `null` when it has none. */
  code: z.string().nullable(),
  options: z.array(OptionTextSchema),
  selectedOptionIds: z.array(Id),
  flagged: z.boolean(),
});
export type SessionQuestion = z.infer<typeof SessionQuestionSchema>;

/**
 * `AttemptSession`: an attempt in progress, from start or a reload. `serverTime` and `deadlineAt`
 * drive the countdown; `expired` means the time is up and the attempt is not graded yet.
 */
export const AttemptSessionSchema = z.object({
  attemptId: Id,
  quizId: Id,
  quizTitle: z.string(),
  attemptNo: z.number().int(),
  status: LearnerAttemptStatusSchema,
  startedAt: BackendDateTimeSchema,
  deadlineAt: BackendDateTimeSchema,
  serverTime: BackendDateTimeSchema,
  expired: z.boolean(),
  totalQuestions: z.number().int(),
  questions: z.array(SessionQuestionSchema),
});
export type AttemptSession = z.infer<typeof AttemptSessionSchema>;

/** The patch the server accepts for one question: a field left out is kept, `[]` clears the choice. */
export const SaveAnswerBodySchema = z.object({
  selectedOptionIds: z.array(Id).optional(),
  flagged: z.boolean().optional(),
});
export type SaveAnswerBody = z.infer<typeof SaveAnswerBodySchema>;

/** `AnswerReceipt`: what the server stored for the question. */
export const AnswerReceiptSchema = z.object({
  attemptQuestionId: Id,
  selectedOptionIds: z.array(Id),
  flagged: z.boolean(),
  savedAt: BackendDateTimeSchema,
  deadlineAt: BackendDateTimeSchema,
  serverTime: BackendDateTimeSchema,
});
export type AnswerReceipt = z.infer<typeof AnswerReceiptSchema>;

export const CompetencyScoreSchema = z.object({
  competencyId: Id,
  code: z.string(),
  name: z.string(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  maxScore: z.number(),
  score: z.number(),
});
export type CompetencyScore = z.infer<typeof CompetencyScoreSchema>;

export const ReviewOptionSchema = z.object({
  id: Id,
  content: z.string(),
  correct: z.boolean(),
  selected: z.boolean(),
});

/** `ReviewQuestion`: only present once the quiz's review policy lets the caller see the key. */
export const ReviewQuestionSchema = z.object({
  displayOrder: z.number().int(),
  questionType: LearnerQuestionTypeSchema,
  content: z.string(),
  options: z.array(ReviewOptionSchema),
  correct: z.boolean(),
  points: z.number(),
  scoreAwarded: z.number(),
  explanation: z.string().nullable(),
});
export type ReviewQuestion = z.infer<typeof ReviewQuestionSchema>;

/** `AttemptResult`: the graded attempt. `review` is null until the review policy allows it. */
export const LearnerAttemptResultSchema = z.object({
  attemptId: Id,
  quizId: Id,
  quizTitle: z.string(),
  courseId: Id,
  attemptNo: z.number().int(),
  status: LearnerAttemptStatusSchema,
  submitType: LearnerSubmitTypeSchema.nullable(),
  startedAt: BackendDateTimeSchema,
  submittedAt: BackendDateTimeSchema.nullable(),
  durationSeconds: z.number().int().nullable(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  rawScore: z.number(),
  maxScore: z.number(),
  scorePercent: z.number(),
  passPercent: z.number(),
  passed: z.boolean(),
  summary: LearnerAttemptSummarySchema,
  competencies: z.array(CompetencyScoreSchema),
  reviewPolicy: LearnerReviewPolicySchema,
  reviewAvailable: z.boolean(),
  review: z.array(ReviewQuestionSchema).nullable(),
});
export type LearnerAttemptResult = z.infer<typeof LearnerAttemptResultSchema>;

/** `AttemptRow`: one attempt in the history of a quiz. */
export const LearnerAttemptRowSchema = z.object({
  attemptId: Id,
  attemptNo: z.number().int(),
  status: LearnerAttemptStatusSchema,
  submitType: LearnerSubmitTypeSchema.nullable(),
  startedAt: BackendDateTimeSchema,
  submittedAt: BackendDateTimeSchema.nullable(),
  durationSeconds: z.number().int().nullable(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int().nullable(),
  scorePercent: z.number().nullable(),
  passed: z.boolean().nullable(),
});
export type LearnerAttemptRow = z.infer<typeof LearnerAttemptRowSchema>;

/** `AttemptHistory`: every attempt of the caller for one quiz, in order. */
export const LearnerAttemptHistorySchema = z.object({
  quizId: Id,
  quizTitle: z.string(),
  summary: LearnerAttemptSummarySchema,
  attempts: z.array(LearnerAttemptRowSchema),
});
export type LearnerAttemptHistory = z.infer<typeof LearnerAttemptHistorySchema>;

/** `MyAttemptRow`: an attempt across every quiz, for the learner's own list. */
export const MyAttemptRowSchema = z.object({
  attemptId: Id,
  quizId: Id,
  quizTitle: z.string(),
  courseId: Id,
  attemptNo: z.number().int(),
  status: LearnerAttemptStatusSchema,
  submitType: LearnerSubmitTypeSchema.nullable(),
  startedAt: BackendDateTimeSchema,
  submittedAt: BackendDateTimeSchema.nullable(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int().nullable(),
  scorePercent: z.number().nullable(),
  passed: z.boolean().nullable(),
});
export type MyAttemptRow = z.infer<typeof MyAttemptRowSchema>;
export const MyAttemptPageSchema = PageSchema(MyAttemptRowSchema);

export const MyAttemptsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  passed: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  quizId: Id.optional(),
  status: LearnerAttemptStatusSchema.optional(),
  /** `true` keeps the graded attempts only (`SUBMITTED`, `AUTO_SUBMITTED`); combined with `status` by AND. */
  graded: z.boolean().optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
});
export type MyAttemptsQuery = z.infer<typeof MyAttemptsQuerySchema>;

export const MyAttemptsExportQuerySchema = MyAttemptsQuerySchema.pick({
  quizId: true,
  status: true,
  graded: true,
  sort: true,
});

/**
 * `MyCompetency`: the caller's result for one competency across every graded attempt. `percent` is
 * null when `maxScore` is 0: the server decides when there is no data, so the app never computes it.
 */
export const MyCompetencySchema = z.object({
  competencyId: Id,
  code: z.string(),
  name: z.string(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  maxScore: z.number(),
  score: z.number(),
  percent: z.number().nullable(),
});
export type MyCompetency = z.infer<typeof MyCompetencySchema>;
