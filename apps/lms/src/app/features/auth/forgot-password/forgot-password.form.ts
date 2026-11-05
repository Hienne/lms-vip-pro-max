import { REGISTRATION_LIMITS, STAFF_CODE_PATTERN } from '@lms/contracts';
import { z } from 'zod';

/** The forgot-password form: the staff code, with the backend's rule and Vietnamese messages. */
export const ForgotPasswordFormSchema = z.object({
  staffCode: z
    .string()
    .trim()
    .min(1, { error: 'Nhập mã cán bộ.' })
    .max(REGISTRATION_LIMITS.staffCode, {
      error: `Mã cán bộ tối đa ${REGISTRATION_LIMITS.staffCode} ký tự.`,
    })
    .refine((value) => value === '' || STAFF_CODE_PATTERN.test(value), {
      error: 'Mã cán bộ chỉ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang.',
    }),
});
export type ForgotPasswordFormValue = z.infer<typeof ForgotPasswordFormSchema>;

export const EMPTY_FORGOT_PASSWORD_FORM: ForgotPasswordFormValue = {
  staffCode: '',
};
