import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
  REGISTRATION_LIMITS,
  STAFF_CODE_PATTERN,
} from '@lms/contracts';
import { z } from 'zod';

/**
 * The registration form: the backend's rules (`RegisterRequest`) with Vietnamese messages. The
 * unit is the string value of the select, turned into an id when the command is built. The
 * "confirm" field is checked here and never sent.
 */
export const RegisterFormSchema = z
  .object({
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
    fullName: z
      .string()
      .trim()
      .min(1, { error: 'Nhập họ và tên.' })
      .max(REGISTRATION_LIMITS.fullName, {
        error: `Họ và tên tối đa ${REGISTRATION_LIMITS.fullName} ký tự.`,
      }),
    email: z
      .string()
      .trim()
      .min(1, { error: 'Nhập email.' })
      .max(REGISTRATION_LIMITS.email, {
        error: `Email tối đa ${REGISTRATION_LIMITS.email} ký tự.`,
      })
      .refine((value) => value === '' || z.email().safeParse(value).success, {
        error: 'Email không đúng định dạng.',
      }),
    orgId: z.string().min(1, { error: 'Chọn đơn vị.' }),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, {
        error: `Mật khẩu tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`,
      })
      .refine((value) => value.trim() !== '', {
        error: 'Mật khẩu không được để trống.',
      })
      .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
        error: `Mật khẩu tối đa ${PASSWORD_MAX_BYTES} byte (ký tự có dấu chiếm nhiều hơn 1 byte).`,
      }),
    confirm: z.string().min(1, { error: 'Nhập lại mật khẩu.' }),
  })
  .refine((value) => value.password === value.confirm, {
    path: ['confirm'],
    error: 'Mật khẩu nhập lại không khớp.',
  });
export type RegisterFormValue = z.infer<typeof RegisterFormSchema>;

export const EMPTY_REGISTER_FORM: RegisterFormValue = {
  staffCode: '',
  fullName: '',
  email: '',
  orgId: '',
  password: '',
  confirm: '',
};
