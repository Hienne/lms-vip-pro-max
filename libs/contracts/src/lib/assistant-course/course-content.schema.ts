import { z } from 'zod';
import { CourseJobStatusSchema } from './course-job.schema';

/** One lesson of the outline the author edits before approving. */
export const OutlineLessonSchema = z.object({
  title: z.string().trim().min(1).max(255),
  objectives: z.array(z.string().trim().min(1).max(2000)).max(10),
  estimatedMinutes: z.number().int().min(1).max(240),
});
export type OutlineLesson = z.infer<typeof OutlineLessonSchema>;

export const OutlineChapterSchema = z.object({
  title: z.string().trim().min(1).max(255),
  lessons: z.array(OutlineLessonSchema).min(1).max(10),
});
export type OutlineChapter = z.infer<typeof OutlineChapterSchema>;

/** The course outline the model proposes; it is editable until the author approves it. */
export const CourseOutlineSchema = z.object({
  title: z.string().trim().min(1).max(255),
  summary: z.string().trim().min(1).max(4000),
  objectives: z.array(z.string().trim().min(1).max(2000)).max(20),
  chapters: z.array(OutlineChapterSchema).min(1).max(20),
});
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;

export const GeneratedBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), title: z.string(), body: z.string() }),
  z.object({
    type: z.literal('process'),
    title: z.string(),
    steps: z.array(
      z.object({ title: z.string(), description: z.string().nullish() }),
    ),
  }),
]);
export type GeneratedBlock = z.infer<typeof GeneratedBlockSchema>;

/** Where in the source a lesson came from, so the author can check it. */
export const SourceNoteSchema = z.object({ note: z.string() });

/** `pending`, `running`, `done` or `failed`; the server owns the value. */
export const GeneratedLessonSchema = z.object({
  key: z.string(),
  title: z.string().nullish(),
  status: z.string(),
  error: z.string().nullish(),
  blocks: z.array(GeneratedBlockSchema).nullish(),
  sourceNotes: z.array(SourceNoteSchema).nullish(),
});
export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

export const QuestionDecisionSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
]);
export type QuestionDecision = z.infer<typeof QuestionDecisionSchema>;

export const ProposedQuestionSchema = z.object({
  type: z.enum(['SINGLE', 'MULTIPLE']),
  content: z.string(),
  explanation: z.string().nullish(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  options: z.array(z.object({ content: z.string(), correct: z.boolean() })),
  decision: QuestionDecisionSchema.nullish(),
});
export type ProposedQuestion = z.infer<typeof ProposedQuestionSchema>;

export const LessonQuestionsSchema = z.object({
  lessonKey: z.string(),
  status: z.string(),
  error: z.string().nullish(),
  questions: z.array(ProposedQuestionSchema).nullish(),
});
export type LessonQuestions = z.infer<typeof LessonQuestionsSchema>;

/** Everything the model produced for a job, for the author to review. */
export const CourseContentSchema = z.object({
  jobId: z.number().int(),
  status: CourseJobStatusSchema,
  step: z.string().nullish(),
  progress: z.number().int().min(0).max(100),
  error: z.string().nullish(),
  outline: CourseOutlineSchema.nullish(),
  outlineLocked: z.boolean(),
  lessons: z.array(GeneratedLessonSchema),
  questions: z.array(LessonQuestionsSchema),
  createdDraftId: z.number().int().nullish(),
});
export type CourseContent = z.infer<typeof CourseContentSchema>;

export const DecideQuestionCommandSchema = z.object({
  decision: QuestionDecisionSchema,
});
export type DecideQuestionCommand = z.infer<typeof DecideQuestionCommandSchema>;

/** Step statuses that mean the model is still working on it. */
export const WORKING_STEP_STATUSES: readonly string[] = ['pending', 'running'];
