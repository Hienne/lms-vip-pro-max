import { z } from 'zod';

export const ExhaustedLearnerSchema = z.object({
  userId: z.string(),
  userName: z.string().nullish(),
  attemptsUsed: z.number().int().positive(),
});

export const QuizAttemptGrantRequestSchema = z.object({
  userId: z.string().trim().min(1).max(20),
  extraAttempts: z.number().int().min(1).max(10),
  reason: z.string().trim().min(1).max(2000),
});
export type QuizAttemptGrantRequest = z.infer<
  typeof QuizAttemptGrantRequestSchema
>;

export const QuizAttemptGrantSchema = z.object({
  id: z.number().int().positive(),
  quizId: z.number().int().positive(),
  ...QuizAttemptGrantRequestSchema.shape,
  userName: z.string().nullish(),
  grantedBy: z.string(),
  grantedAt: z.iso.datetime({ offset: true }),
  revoked: z.boolean(),
  revokedBy: z.string().nullish(),
  revokedAt: z.iso.datetime({ offset: true }).nullish(),
});
import { BackendDateTimeSchema } from '../http/datetime';
import { PageSchema } from '../http/page';
import { LearnerQuizTypeSchema } from './learner-quiz.schema';

/**
 * The authoring side of the backend's Assessment module (`/api/v1/quizzes`). Only the list is
 * used by the course editor and the assessment administration screens. Fields mirror
 * AssessmentRequests / AssessmentViews; legacy mock DTOs are separate contracts.
 */
export const QuizAuthoringStatusSchema = z.enum([
  'DRAFT',
  'PUBLISHED',
  'CLOSED',
]);
export type QuizAuthoringStatus = z.infer<typeof QuizAuthoringStatusSchema>;

/** `QuizSummary`: one quiz of a course for someone who may manage the course. */
export const QuizSummarySchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  title: z.string(),
  quizType: LearnerQuizTypeSchema,
  status: QuizAuthoringStatusSchema,
  selectionMode: z.string(),
  questionCount: z.number().int(),
  timeLimitMinutes: z.number().int(),
  passPercent: z.number(),
  maxAttempts: z.number().int(),
  openAt: BackendDateTimeSchema.nullable(),
  closeAt: BackendDateTimeSchema.nullable(),
  gradedAttempts: z.number().int(),
  passedAttempts: z.number().int(),
  poolSize: z.number().int(),
  rowVersion: z.number().int(),
  updateTime: BackendDateTimeSchema.nullable(),
});
export type QuizSummary = z.infer<typeof QuizSummarySchema>;

export const QuizSummaryQuerySchema = z.object({
  courseId: z.number().int().positive(),
  q: z.string().max(100).optional(),
  status: QuizAuthoringStatusSchema.optional(),
  quizType: LearnerQuizTypeSchema.optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
});
export type QuizSummaryQuery = z.infer<typeof QuizSummaryQuerySchema>;

export const QuizSummaryPageSchema = PageSchema(QuizSummarySchema);

export const QuestionTypeV1Schema = z.enum(['SINGLE', 'MULTIPLE']);
export const QuestionDifficultyV1Schema = z.enum(['EASY', 'MEDIUM', 'HARD']);
export const AssessmentItemStatusV1Schema = z.enum(['ACTIVE', 'INACTIVE']);
export const SelectionModeV1Schema = z.enum(['FIXED', 'RANDOM_POOL']);
export const ReviewPolicyV1Schema = z.enum([
  'NEVER',
  'AFTER_SUBMIT',
  'AFTER_PASS',
  'AFTER_CLOSE',
]);
export const AssessmentVersionQuerySchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});
export const CompetencyV1Schema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parentId: z.number().int().nullable(),
  sortNo: z.number().int(),
  status: AssessmentItemStatusV1Schema,
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullable(),
  updateTime: BackendDateTimeSchema.nullable(),
});
export const QuestionSummaryV1Schema = z.object({
  id: z.number().int(),
  code: z.string(),
  programId: z.number().int().nullable().optional(),
  courseId: z.number().int().nullable(),
  lessonId: z.number().int().nullable(),
  competencyId: z.number().int(),
  competencyName: z.string().nullable(),
  questionType: QuestionTypeV1Schema,
  contentPreview: z.string(),
  difficulty: QuestionDifficultyV1Schema,
  points: z.number(),
  status: AssessmentItemStatusV1Schema,
  contentVersion: z.number().int(),
  optionCount: z.number().int(),
  correctCount: z.number().int(),
  usedInQuizCount: z.number().int(),
  rowVersion: z.number().int(),
  updateTime: BackendDateTimeSchema.nullable(),
});
export const QuestionDetailV1Schema = z.object({
  id: z.number().int(),
  code: z.string(),
  programId: z.number().int().nullable().optional(),
  courseId: z.number().int().nullable(),
  lessonId: z.number().int().nullable(),
  competencyId: z.number().int(),
  questionType: QuestionTypeV1Schema,
  content: z.string(),
  explanation: z.string().nullable(),
  difficulty: QuestionDifficultyV1Schema,
  points: z.number(),
  status: AssessmentItemStatusV1Schema,
  contentVersion: z.number().int(),
  options: z.array(
    z.object({
      id: z.number().int(),
      content: z.string(),
      correct: z.boolean(),
      sortNo: z.number().int(),
    }),
  ),
  usedInQuizzes: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      status: QuizAuthoringStatusSchema,
    }),
  ),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullable(),
  updateTime: BackendDateTimeSchema.nullable(),
});
export const QuestionRequestV1Schema = z.object({
  courseId: z.number().int().positive(),
  lessonId: z.number().int().positive().nullable(),
  competencyId: z.number().int().positive(),
  code: z.string().max(50),
  questionType: QuestionTypeV1Schema,
  content: z.string().min(1).max(10000),
  explanation: z.string().max(10000).nullable(),
  difficulty: QuestionDifficultyV1Schema,
  points: z.number().min(0.01).max(9999.99),
  status: AssessmentItemStatusV1Schema,
  options: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
        content: z.string().min(1).max(10000),
        correct: z.boolean(),
      }),
    )
    .min(2)
    .max(10),
});
export const QuestionQueryV1Schema = QuizSummaryQuerySchema.omit({
  quizType: true,
  status: true,
}).extend({
  lessonId: z.number().int().positive().optional(),
  competencyId: z.number().int().positive().optional(),
  questionType: QuestionTypeV1Schema.optional(),
  difficulty: QuestionDifficultyV1Schema.optional(),
  status: AssessmentItemStatusV1Schema.optional(),
});
/**
 * The Excel import of questions into one course's bank. `dryRun=true` only checks the file and
 * `false` writes it; `overwrite` replaces questions with the same code instead of refusing them.
 */
export const QuestionImportQuerySchema = z.object({
  courseId: z.number().int().positive(),
  dryRun: z.boolean(),
  overwrite: z.boolean().optional(),
});
export const QuestionImportCommandSchema = z.object({ file: z.file() });
export const QuestionImportResultSchema = z.object({
  dryRun: z.boolean(),
  rowCount: z.number().int(),
  toCreate: z.number().int(),
  toUpdate: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
});
export const QUESTION_IMPORT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  extension: '.xlsx',
  maxRows: 1000,
} as const;
export type QuestionImportQuery = z.infer<typeof QuestionImportQuerySchema>;
export type QuestionImportResult = z.infer<typeof QuestionImportResultSchema>;
export const QuizRequestV1Schema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  description: z.string().max(10000).nullable(),
  quizType: LearnerQuizTypeSchema,
  selectionMode: SelectionModeV1Schema,
  questionCount: z.number().int().min(1).max(200),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  timeLimitMinutes: z.number().int().min(1).max(240),
  openAt: BackendDateTimeSchema.nullable(),
  closeAt: BackendDateTimeSchema.nullable(),
  graceSeconds: z.number().int().min(0).max(300),
  passPercent: z.number().min(0.01).max(100),
  scoringMode: z.enum(['ALL_OR_NOTHING', 'PARTIAL']),
  scoreMethod: z.enum(['BEST', 'LAST']),
  reviewPolicy: ReviewPolicyV1Schema,
  maxAttempts: z.number().int().min(1).max(20),
  retakeWaitHours: z.number().int().min(0).max(720),
  allowRetakeAfterPass: z.boolean(),
  requireLessonsCompleted: z.boolean(),
});
export const QuizViewV1Schema = QuizRequestV1Schema.extend({
  id: z.number().int(),
  status: QuizAuthoringStatusSchema,
  publishedAt: BackendDateTimeSchema.nullable(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullable(),
  updateTime: BackendDateTimeSchema.nullable(),
});
export const QuizPoolEntryV1Schema = z.object({
  questionId: z.number().int(),
  code: z.string(),
  contentPreview: z.string(),
  questionType: QuestionTypeV1Schema,
  difficulty: QuestionDifficultyV1Schema,
  status: AssessmentItemStatusV1Schema,
  sortNo: z.number().int(),
  pointsOverride: z.number().nullable(),
  effectivePoints: z.number(),
});
export const QuizDetailV1Schema = z.object({
  quiz: QuizViewV1Schema,
  pool: z.array(QuizPoolEntryV1Schema),
  activePoolSize: z.number().int(),
});
export const QuizPoolRequestV1Schema = z.object({
  items: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        sortNo: z.number().int().nonnegative(),
        points: z.number().min(0.01).max(9999.99).nullable(),
      }),
    )
    .max(2000),
});
export type QuestionSummaryV1 = z.infer<typeof QuestionSummaryV1Schema>;
export type QuestionDetailV1 = z.infer<typeof QuestionDetailV1Schema>;
export type QuestionRequestV1 = z.infer<typeof QuestionRequestV1Schema>;
export type QuestionQueryV1 = z.infer<typeof QuestionQueryV1Schema>;
export type QuizRequestV1 = z.infer<typeof QuizRequestV1Schema>;
export type QuizDetailV1 = z.infer<typeof QuizDetailV1Schema>;
export type QuizPoolRequestV1 = z.infer<typeof QuizPoolRequestV1Schema>;
