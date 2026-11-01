import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';

/** AssessmentViews and AssessmentReportController, distinct from the proposed training reports. */
export const AssessmentReportTypeSchema = z.enum([
  'results',
  'learners',
  'competency',
  'questions',
]);
export type AssessmentReportType = z.infer<typeof AssessmentReportTypeSchema>;
export const AssessmentReportFilterSchema = z.object({
  orgId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  quizId: z.number().int().positive().optional(),
  from: BackendDateTimeSchema.optional(),
  to: BackendDateTimeSchema.optional(),
});
export const AssessmentReportResultQuerySchema =
  AssessmentReportFilterSchema.extend({
    userId: z.string().optional(),
    status: z
      .enum(['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'VOIDED'])
      .optional(),
    passed: z.boolean().optional(),
  }).merge(PageQuerySchema);
export const AssessmentReportLearnerQuerySchema = PageQuerySchema.extend({
  quizId: z.number().int().positive(),
  orgId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  learnerStatus: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'PASSED'])
    .optional(),
});
export const AssessmentReportCompetencyQuerySchema =
  AssessmentReportFilterSchema.extend({
    groupBy: z.enum(['user', 'org']).optional(),
  }).merge(PageQuerySchema);
export const AssessmentReportQuestionQuerySchema =
  AssessmentReportFilterSchema.merge(PageQuerySchema);
export const AssessmentReportExportQuerySchema =
  AssessmentReportResultQuerySchema.omit({ page: true, size: true }).extend({
    groupBy: z.enum(['user', 'org']).optional(),
    learnerStatus: z
      .enum(['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'PASSED'])
      .optional(),
  });
const group = z.object({
  id: z.number().int().nullable(),
  name: z.string().nullable(),
  gradedAttempts: z.number().int(),
  learners: z.number().int(),
  passedLearners: z.number().int(),
  passRate: z.number().nullable(),
  averageScore: z.number().nullable(),
});
export const AssessmentReportOverviewSchema = z.object({
  gradedAttempts: z.number().int(),
  learners: z.number().int(),
  passedLearners: z.number().int(),
  passRate: z.number().nullable(),
  averageScore: z.number().nullable(),
  inProgressAttempts: z.number().int(),
  byQuiz: z.array(group),
  byOrg: z.array(group),
});
export const AssessmentReportResultRowSchema = z.object({
  attemptId: z.number().int(),
  quizId: z.number().int(),
  quizTitle: z.string(),
  courseId: z.number().int(),
  userId: z.string(),
  userName: z.string().nullable(),
  orgId: z.number().int().nullable(),
  orgName: z.string().nullable(),
  teamId: z.number().int().nullable(),
  teamName: z.string().nullable(),
  attemptNo: z.number().int(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'VOIDED']),
  submitType: z.string().nullable(),
  startedAt: BackendDateTimeSchema,
  submittedAt: BackendDateTimeSchema.nullable(),
  correctCount: z.number().int(),
  totalQuestions: z.number().int(),
  scorePercent: z.number().nullable(),
  passed: z.boolean().nullable(),
});
export const AssessmentReportLearnerRowSchema = z.object({
  userId: z.string(),
  userName: z.string().nullable(),
  enrollmentId: z.number().int(),
  orgId: z.number().int().nullable(),
  orgName: z.string().nullable(),
  teamId: z.number().int().nullable(),
  teamName: z.string().nullable(),
  learnerStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'PASSED']),
  attemptsUsed: z.number().int(),
  attemptsLeft: z.number().int(),
  bestScore: z.number().nullable(),
  lastScore: z.number().nullable(),
  finalScore: z.number().nullable(),
  passed: z.boolean(),
  lastSubmittedAt: BackendDateTimeSchema.nullable(),
});
export const AssessmentReportCompetencyRowSchema = z.object({
  groupKey: z.string(),
  groupName: z.string().nullable(),
  competencyId: z.number().int(),
  code: z.string(),
  name: z.string(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  maxScore: z.number(),
  score: z.number(),
  percent: z.number().nullable(),
});
export const AssessmentReportQuestionRowSchema = z.object({
  questionId: z.number().int(),
  questionVersion: z.number().int(),
  code: z.string().nullable(),
  contentPreview: z.string(),
  timesServed: z.number().int(),
  timesCorrect: z.number().int(),
  timesBlank: z.number().int(),
  wrongPercent: z.number().nullable(),
});
export type AssessmentReportFilter = z.infer<
  typeof AssessmentReportFilterSchema
>;
export type AssessmentReportExportQuery = z.infer<
  typeof AssessmentReportExportQuerySchema
>;
