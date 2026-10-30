import { COMMUNITY_LIMITS } from '@lms/contracts';
import { z } from 'zod';

/** What the report dialog collects; the screen adds the target and sends C-report. */
export const ReportFormSchema = z.object({
  reasonCode: z.string().min(1, 'Chọn một lý do'),
  description: z
    .string()
    .max(
      COMMUNITY_LIMITS.reportDescription.max,
      `Tối đa ${COMMUNITY_LIMITS.reportDescription.max} ký tự`,
    ),
});
export type ReportFormValue = z.infer<typeof ReportFormSchema>;

export interface ReportDraft {
  readonly reasonCode: string;
  readonly description?: string;
}
