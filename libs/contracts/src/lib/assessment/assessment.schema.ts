import { z } from 'zod';
import { PageSchema } from '../http/page';

const Id = z.string().min(1);
const DateTime = z.iso.datetime({ offset: true });
export const AssessmentOptionSchema = z.object({
  id: Id,
  text: z.string().min(1),
});
export const SaveQuestionSchema = z.object({
  code: z.string(),
  text: z.string().min(1),
  type: z.enum(['single', 'multiple']),
  options: z.array(AssessmentOptionSchema).min(2).max(8),
  correctOptionIds: z.array(Id).min(1),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  domainId: Id,
  lessonId: Id.nullable(),
  competency: z.string().min(1),
  status: z.enum(['active', 'inactive']),
});
export const QuestionSchema = SaveQuestionSchema.extend({
  id: Id,
  usedIn: z.array(z.object({ id: Id, title: z.string() })),
  updatedAt: DateTime,
});
export const SaveQuizConfigSchema = z.object({
  title: z.string().min(1),
  courseId: Id,
  status: z.enum(['draft', 'published']),
  source: z.enum(['manual', 'random']),
  questionIds: z.array(Id),
  questionCount: z.number().int().min(1).max(200),
  minutes: z.number().int().min(1).max(240),
  passPct: z.number().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(20),
  retakeWaitHours: z.number().min(0).max(720),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  openAt: DateTime,
  closeAt: DateTime,
  reviewPolicy: z.enum(['never', 'after_submit', 'after_pass', 'after_close']),
  expectedVersion: z.number().int().optional(),
});
export const QuizConfigSchema = SaveQuizConfigSchema.omit({
  expectedVersion: true,
}).extend({ id: Id, version: z.number().int() });
export const QuizListRowSchema = QuizConfigSchema.pick({
  id: true,
  title: true,
  courseId: true,
  status: true,
  questionCount: true,
}).extend({
  courseTitle: z.string(),
  attempts: z.number(),
  passRate: z.number().nullable(),
});
export const AssessmentOptionsSchema = z.object({
  courses: z.array(z.object({ id: Id, title: z.string() })),
  domains: z.array(z.object({ id: Id, name: z.string() })),
  lessons: z.array(z.object({ id: Id, title: z.string(), courseId: Id })),
  competencies: z.array(z.string()),
});
export type Question = z.infer<typeof QuestionSchema>;
export type SaveQuestion = z.infer<typeof SaveQuestionSchema>;
export type QuizConfig = z.infer<typeof QuizConfigSchema>;
export type SaveQuizConfig = z.infer<typeof SaveQuizConfigSchema>;
