import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageSchema } from '../http/page';
import { LearnerQuizTypeSchema } from './learner-quiz.schema';

/**
 * The authoring side of the backend's Assessment module (`/api/v1/quizzes`). Only the list is
 * declared: the course editor reads it to pick the quiz of a quiz lesson. The admin question and
 * quiz screens still use the proposed `assessmentEndpoints`.
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
