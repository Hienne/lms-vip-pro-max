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
const QuizHeaderSchema = z.object({
  id: Id,
  title: z.string(),
  courseId: Id,
  passPct: z.number(),
});
const SummarySchema = z.object({
  attempts: z.number(),
  left: z.number(),
  last: z.number().nullable(),
  best: z.number().nullable(),
  passed: z.boolean(),
  maxAttempts: z.number(),
  nextAllowedAt: DateTime.nullable(),
});
export const QuizIntroSchema = z.object({
  quiz: QuizConfigSchema.pick({
    id: true,
    title: true,
    courseId: true,
    minutes: true,
    questionCount: true,
    passPct: true,
    maxAttempts: true,
    retakeWaitHours: true,
    openAt: true,
    closeAt: true,
    reviewPolicy: true,
  }).extend({ hasMultiple: z.boolean() }),
  course: z.object({ id: Id, title: z.string() }),
  summary: SummarySchema,
  block: z
    .object({
      code: z.enum(['not_open', 'closed', 'passed', 'no_attempts', 'wait']),
      message: z.string(),
      nextAllowedAt: DateTime.optional(),
    })
    .nullable(),
  pendingAttemptId: Id.nullable(),
  lessonsDone: z.boolean(),
});
/** Learner payload deliberately omits answer keys and explanations. */
export const TakeQuestionSchema = SaveQuestionSchema.pick({
  code: true,
  text: true,
  type: true,
  options: true,
}).extend({ id: Id });
export const AttemptSnapshotSchema = z.object({
  attempt: z.object({
    id: Id,
    quizId: Id,
    startedAt: DateTime,
    deadlineAt: DateTime,
    revision: z.number().int(),
    answers: z.record(Id, z.array(Id)),
    flags: z.array(Id),
    status: z.enum(['in_progress', 'submitted']),
  }),
  quiz: QuizHeaderSchema,
  questions: z.array(TakeQuestionSchema),
  serverNow: DateTime,
});
export const SaveAnswerSchema = z.object({
  optionIds: z.array(Id),
  flagged: z.boolean(),
  clientSeq: z.number().int().nonnegative(),
});
export const SavedAnswerSchema = SaveAnswerSchema.omit({
  clientSeq: true,
}).extend({
  questionId: Id,
  revision: z.number().int(),
  savedAt: DateTime,
  serverNow: DateTime,
});
export const SubmitAttemptSchema = z.object({
  attemptId: Id,
  quizId: Id,
  status: z.literal('submitted'),
  submittedAt: DateTime,
  autoSubmitted: z.boolean(),
  resultPath: z.string(),
});
export const AttemptRowSchema = z.object({
  id: Id,
  nth: z.number(),
  score: z.number(),
  passed: z.boolean(),
  correctCount: z.number(),
  total: z.number(),
  startedAt: DateTime,
  submittedAt: DateTime,
  minutes: z.number(),
  autoSubmitted: z.boolean(),
});
export const AttemptHistorySchema = z.object({
  quiz: QuizHeaderSchema,
  summary: SummarySchema,
  attempts: PageSchema(AttemptRowSchema),
});
export const AttemptResultSchema = z.object({
  attempt: AttemptRowSchema,
  quiz: QuizHeaderSchema,
  course: z.object({ id: Id, title: z.string() }),
  summary: SummarySchema,
  competency: z.array(
    z.object({ name: z.string(), correctCount: z.number(), total: z.number() }),
  ),
  reviewAllowed: z.boolean(),
  reviewMessage: z.string().nullable(),
  review: z
    .array(
      TakeQuestionSchema.omit({ id: true }).extend({
        number: z.number(),
        questionId: Id,
        mine: z.array(Id),
        correctOptionIds: z.array(Id),
        ok: z.boolean(),
        explanation: z.string(),
      }),
    )
    .nullable(),
  courseCompleted: z.boolean(),
  certificateId: Id.nullable(),
});
export type Question = z.infer<typeof QuestionSchema>;
export type SaveQuestion = z.infer<typeof SaveQuestionSchema>;
export type QuizConfig = z.infer<typeof QuizConfigSchema>;
export type SaveQuizConfig = z.infer<typeof SaveQuizConfigSchema>;
export type AttemptSnapshot = z.infer<typeof AttemptSnapshotSchema>;
export type SaveAnswer = z.infer<typeof SaveAnswerSchema>;
export type AttemptResult = z.infer<typeof AttemptResultSchema>;
