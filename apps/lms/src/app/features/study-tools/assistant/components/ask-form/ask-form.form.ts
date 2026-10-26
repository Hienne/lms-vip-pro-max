import { MAX_QUESTION_LENGTH } from '@lms/contracts';
import { z } from 'zod';

/** The question box: 1 to 300 characters once trimmed, as the backend requires. */
export const AskFormSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, { error: 'Nhập câu hỏi.' })
    .max(MAX_QUESTION_LENGTH, {
      error: `Câu hỏi tối đa ${MAX_QUESTION_LENGTH} ký tự.`,
    }),
});

export type AskFormValue = z.input<typeof AskFormSchema>;
