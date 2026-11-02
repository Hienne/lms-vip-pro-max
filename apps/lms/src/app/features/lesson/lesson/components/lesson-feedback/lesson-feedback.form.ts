import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH } from '@lms/contracts';
import { z } from 'zod';

/**
 * A comment, a question or a report: 5 to 1000 characters once trimmed, as the backend requires. The
 * messages are the server's, because a refusal is a toast and never lands under the field.
 */
export const FeedbackFormSchema = z.object({
  text: z
    .string()
    .trim()
    .min(FEEDBACK_MIN_LENGTH, { error: 'Nội dung cần tối thiểu 5 ký tự.' })
    .max(FEEDBACK_MAX_LENGTH, { error: 'Nội dung tối đa 1000 ký tự.' }),
});

export type FeedbackFormValue = z.input<typeof FeedbackFormSchema>;
