import { z } from 'zod';

/** One option of a checkpoint question; the payload never says which options are right. */
export const CheckpointOptionSchema = z.object({
  id: z.number().int(),
  content: z.string(),
});
export type CheckpointOption = z.infer<typeof CheckpointOptionSchema>;

export const CheckpointQuestionSchema = z.object({
  questionId: z.number().int(),
  questionVersion: z.number().int(),
  questionType: z.enum(['SINGLE', 'MULTIPLE']),
  content: z.string(),
  options: z.array(CheckpointOptionSchema),
});
export type CheckpointQuestion = z.infer<typeof CheckpointQuestionSchema>;

/** Up to three recall questions of a lesson, from its published flashcards; empty when it has none. */
export const CheckpointSchema = z.object({
  lessonId: z.number().int(),
  questions: z.array(CheckpointQuestionSchema).max(3),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

export const CheckpointAnswerBodySchema = z.object({
  questionId: z.number().int(),
  questionVersion: z.number().int(),
  optionIds: z.array(z.number().int()).min(1),
});
export type CheckpointAnswerBody = z.infer<typeof CheckpointAnswerBodySchema>;

/** The server's grading of one answer, with the key and the author's explanation. */
export const CheckpointResultSchema = z.object({
  correct: z.boolean(),
  correctOptionIds: z.array(z.number().int()),
  explanation: z.string().nullable(),
});
export type CheckpointResult = z.infer<typeof CheckpointResultSchema>;

/** `messageCode` of the refusal when the question changed or left the lesson: reload the checkpoint. */
export const CHECKPOINT_STALE_CODE = 'ASSESSMENT-CHECKPOINT_STALE';
