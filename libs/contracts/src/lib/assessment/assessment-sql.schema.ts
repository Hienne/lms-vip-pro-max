/**
 * DTOs aligned to assessment_schema.sql. PostgreSQL snake_case columns become camelCase JSON;
 * IDs stay strings in the browser to avoid bigint precision loss. These schemas define the
 * proposed Java API boundary; they are separate from the current screen mock adapter.
 */
import { z } from 'zod';
import { PageSchema } from '../http/page';

const Id = z.string().regex(/^\d+$/, 'ID phải là chuỗi số bigint');
const DateTime = z.iso.datetime({ offset: true });
const NullableDateTime = DateTime.nullable();
const NullableId = Id.nullable();

export const AssessmentStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const QuestionTypeSchema = z.enum(['SINGLE', 'MULTIPLE']);
export const DifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const QuizStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']);
export const QuizTypeSchema = z.enum(['PRACTICE', 'FINAL_EXAM']);
export const SelectionModeSchema = z.enum(['FIXED', 'RANDOM_POOL']);
export const ScoringModeSchema = z.enum(['ALL_OR_NOTHING', 'PARTIAL']);
export const ScoreMethodSchema = z.enum(['BEST', 'LAST']);
export const ReviewPolicySchema = z.enum([
  'NEVER',
  'AFTER_SUBMIT',
  'AFTER_PASS',
  'AFTER_CLOSE',
]);
export const AttemptStatusSchema = z.enum([
  'IN_PROGRESS',
  'SUBMITTED',
  'AUTO_SUBMITTED',
  'VOIDED',
]);
export const SubmitTypeSchema = z.enum([
  'MANUAL',
  'TIMEOUT',
  'QUIZ_CLOSED',
  'ADMIN',
]);

/** competency row projection */
export const CompetencyDtoSchema = z.object({
  id: Id,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: NullableId,
  sortOrder: z.number().int(),
  status: AssessmentStatusSchema,
});

/** Admin option includes isCorrect; never use this DTO in a learner attempt response. */
export const AdminQuestionOptionDtoSchema = z.object({
  id: Id,
  content: z.string(),
  isCorrect: z.boolean(),
  sortOrder: z.number().int(),
});
/** Safe learner option projection: deliberately has no isCorrect field. */
export const LearnerQuestionOptionDtoSchema = z.object({
  id: Id,
  content: z.string(),
});

/** question + question_option admin projection */
export const QuestionDtoSchema = z.object({
  id: Id,
  code: z.string().nullable(),
  courseId: Id,
  lessonId: NullableId,
  competencyId: Id,
  questionType: QuestionTypeSchema,
  content: z.string(),
  explanation: z.string().nullable(),
  difficulty: DifficultySchema,
  points: z.number().positive(),
  status: AssessmentStatusSchema,
  version: z.number().int().positive(),
  options: z.array(AdminQuestionOptionDtoSchema).min(2),
  createdAt: DateTime,
  createdBy: NullableId,
  updatedAt: NullableDateTime,
  updatedBy: NullableId,
});
export const SaveQuestionDtoSchema = QuestionDtoSchema.pick({
  code: true,
  courseId: true,
  lessonId: true,
  competencyId: true,
  questionType: true,
  content: true,
  explanation: true,
  difficulty: true,
  points: true,
  status: true,
  options: true,
}).extend({
  options: z
    .array(
      AdminQuestionOptionDtoSchema.omit({ id: true }).extend({
        id: Id.optional(),
      }),
    )
    .min(2),
  expectedVersion: z.number().int().positive().optional(),
});

/** quiz_question association; points=null means inherit question.points */
export const QuizQuestionDtoSchema = z.object({
  questionId: Id,
  sortOrder: z.number().int(),
  points: z.number().positive().nullable(),
});
/** quiz row projection */
export const QuizDtoSchema = z.object({
  id: Id,
  courseId: Id,
  title: z.string(),
  description: z.string().nullable(),
  quizType: QuizTypeSchema,
  status: QuizStatusSchema,
  selectionMode: SelectionModeSchema,
  questionCount: z.number().int().min(1).max(200),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  timeLimitMinutes: z.number().int().min(1).max(240),
  openAt: NullableDateTime,
  closeAt: NullableDateTime,
  graceSeconds: z.number().int().min(0).max(300),
  passPercent: z.number().min(0).max(100),
  scoringMode: ScoringModeSchema,
  scoreMethod: ScoreMethodSchema,
  reviewPolicy: ReviewPolicySchema,
  maxAttempts: z.number().int().min(1).max(20),
  retakeWaitHours: z.number().int().min(0).max(720),
  allowRetakeAfterPass: z.boolean(),
  requireLessonsCompleted: z.boolean(),
  publishedAt: NullableDateTime,
  questionPool: z.array(QuizQuestionDtoSchema),
  createdAt: DateTime,
  createdBy: NullableId,
  updatedAt: NullableDateTime,
  updatedBy: NullableId,
});
export const SaveQuizDtoSchema = QuizDtoSchema.pick({
  courseId: true,
  title: true,
  description: true,
  quizType: true,
  status: true,
  selectionMode: true,
  questionCount: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  timeLimitMinutes: true,
  openAt: true,
  closeAt: true,
  graceSeconds: true,
  passPercent: true,
  scoringMode: true,
  scoreMethod: true,
  reviewPolicy: true,
  maxAttempts: true,
  retakeWaitHours: true,
  allowRetakeAfterPass: true,
  requireLessonsCompleted: true,
  questionPool: true,
});

/** v_quiz_user_summary view: null when no graded attempt exists. */
export const QuizUserSummaryDtoSchema = z.object({
  quizId: Id,
  userId: Id,
  maxAttempts: z.number().int(),
  extraAttempts: z.number().int(),
  attemptsUsed: z.number().int(),
  attemptsLeft: z.number().int(),
  attemptsGraded: z.number().int(),
  bestScore: z.number().nullable(),
  lastScore: z.number().nullable(),
  lastAttemptId: NullableId,
  finalScore: z.number().nullable(),
  passed: z.boolean(),
  firstPassedAt: NullableDateTime,
  lastSubmittedAt: NullableDateTime,
  runningAttemptId: NullableId,
});

/** quiz_attempt row projection. Nullable result columns remain null while the attempt is running. */
export const QuizAttemptDtoSchema = z.object({
  id: Id,
  quizId: Id,
  userId: Id,
  assignmentId: NullableId,
  attemptNo: z.number().int().positive(),
  status: AttemptStatusSchema,
  submitType: SubmitTypeSchema.nullable(),
  startedAt: DateTime,
  deadlineAt: DateTime,
  submittedAt: NullableDateTime,
  lastSavedAt: NullableDateTime,
  timeLimitMinutes: z.number().int(),
  passPercent: z.number(),
  scoringMode: ScoringModeSchema,
  totalQuestions: z.number().int(),
  maxScore: z.number(),
  correctCount: z.number().int().nullable(),
  rawScore: z.number().nullable(),
  scorePercent: z.number().nullable(),
  passed: z.boolean().nullable(),
  gradedAt: NullableDateTime,
  orgId: NullableId,
  teamId: NullableId,
  rowVersion: z.number().int(),
});

/** attempt_question projection for an active attempt; correctOptionIds/explanation are excluded. */
export const AttemptQuestionDtoSchema = z.object({
  attemptQuestionId: Id,
  questionId: Id,
  questionVersion: z.number().int(),
  displayOrder: z.number().int().positive(),
  questionType: QuestionTypeSchema,
  content: z.string(),
  options: z.array(LearnerQuestionOptionDtoSchema),
  points: z.number().positive(),
  competencyId: NullableId,
  difficulty: DifficultySchema.nullable(),
  isFlagged: z.boolean(),
  selectedOptionIds: z.array(Id),
});
/** Added to the attempt result only when reviewPolicy permits it. */
export const AttemptQuestionReviewDtoSchema = AttemptQuestionDtoSchema.extend({
  correctOptionIds: z.array(Id),
  explanation: z.string().nullable(),
  isCorrect: z.boolean().nullable(),
  scoreAwarded: z.number().nullable(),
});

/** attempt_answer row projection */
export const AttemptAnswerDtoSchema = z.object({
  id: Id,
  attemptQuestionId: Id,
  selectedOptionIds: z.array(Id),
  isCorrect: z.boolean().nullable(),
  scoreAwarded: z.number().nullable(),
  answeredAt: DateTime,
  updatedAt: NullableDateTime,
  changeCount: z.number().int(),
});

/** v_question_item_stats view */
export const QuestionItemStatsDtoSchema = z.object({
  questionId: Id,
  questionVersion: z.number().int(),
  timesServed: z.number().int(),
  timesCorrect: z.number().int(),
  timesBlank: z.number().int(),
  wrongPercent: z.number(),
});
/** v_attempt_competency view */
export const AttemptCompetencyDtoSchema = z.object({
  attemptId: Id,
  quizId: Id,
  userId: Id,
  orgId: NullableId,
  submittedAt: DateTime,
  competencyId: Id,
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  maxScore: z.number(),
  score: z.number(),
});

/** API commands/aggregates. */
export const StartAttemptCommandDtoSchema = z.object({
  requestId: z.string().uuid(),
});
export const SaveAttemptAnswerCommandDtoSchema = z.object({
  selectedOptionIds: z.array(Id),
  expectedRowVersion: z.number().int().nonnegative(),
});
export const SubmitAttemptCommandDtoSchema = z.object({
  requestId: z.string().uuid(),
  submitType: z.enum(['MANUAL', 'TIMEOUT']),
});
export const SaveAttemptAnswerResultDtoSchema = z.object({
  attemptQuestionId: Id,
  selectedOptionIds: z.array(Id),
  savedAt: DateTime,
  rowVersion: z.number().int(),
});
export const SubmitAttemptResultDtoSchema = z.object({
  attempt: QuizAttemptDtoSchema,
  competencyResults: z.array(AttemptCompetencyDtoSchema),
});
export const QuizIntroDtoSchema = z.object({
  quiz: QuizDtoSchema,
  courseTitle: z.string(),
  summary: QuizUserSummaryDtoSchema.nullable(),
  currentAttempt: QuizAttemptDtoSchema.nullable(),
  lessonsCompleted: z.boolean().nullable(),
});
export const AttemptSnapshotDtoSchema = z.object({
  attempt: QuizAttemptDtoSchema,
  quizTitle: z.string(),
  questions: z.array(AttemptQuestionDtoSchema),
  serverNow: DateTime,
});
export const AttemptResultDtoSchema = z.object({
  attempt: QuizAttemptDtoSchema,
  quizTitle: z.string(),
  courseId: Id,
  courseTitle: z.string(),
  summary: QuizUserSummaryDtoSchema.nullable(),
  questions: z.array(AttemptQuestionReviewDtoSchema).nullable(),
  competencyResults: z.array(AttemptCompetencyDtoSchema),
  reviewAllowed: z.boolean(),
  reviewMessage: z.string().nullable(),
});

export const AssessmentQuestionPageDtoSchema = PageSchema(QuestionDtoSchema);
export const AssessmentQuizPageDtoSchema = PageSchema(
  QuizDtoSchema.extend({ courseTitle: z.string().optional() }),
);

export type CompetencyDto = z.infer<typeof CompetencyDtoSchema>;
export type QuestionDto = z.infer<typeof QuestionDtoSchema>;
export type SaveQuestionDto = z.infer<typeof SaveQuestionDtoSchema>;
export type QuizDto = z.infer<typeof QuizDtoSchema>;
export type SaveQuizDto = z.infer<typeof SaveQuizDtoSchema>;
export type QuizUserSummaryDto = z.infer<typeof QuizUserSummaryDtoSchema>;
export type QuizAttemptDto = z.infer<typeof QuizAttemptDtoSchema>;
export type AttemptQuestionDto = z.infer<typeof AttemptQuestionDtoSchema>;
export type AttemptAnswerDto = z.infer<typeof AttemptAnswerDtoSchema>;
export type QuestionItemStatsDto = z.infer<typeof QuestionItemStatsDtoSchema>;
export type AttemptCompetencyDto = z.infer<typeof AttemptCompetencyDtoSchema>;
export type QuizIntroDto = z.infer<typeof QuizIntroDtoSchema>;
export type AttemptSnapshotDto = z.infer<typeof AttemptSnapshotDtoSchema>;
export type AttemptResultDto = z.infer<typeof AttemptResultDtoSchema>;
