import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
} from '@lms/contracts';
import { z } from 'zod';

/**
 * The password change form: the backend's rules (`PasswordChangeRequest`) with Vietnamese
 * messages. A new password is at least 6 characters and at most 72 UTF-8 bytes (accented letters
 * take 2 or 3), not blank, and different from the current one. Whether the current password is
 * right is the server's call and arrives as a refusal toast.
 */
export const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, { error: 'Nhập mật khẩu hiện tại.' }),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, {
        error: `Mật khẩu mới tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`,
      })
      .refine((value) => value.trim() !== '', {
        error: 'Mật khẩu mới không được để trống.',
      })
      .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
        error: `Mật khẩu mới tối đa ${PASSWORD_MAX_BYTES} byte (ký tự có dấu chiếm nhiều hơn 1 byte).`,
      }),
    confirm: z.string().min(1, { error: 'Nhập lại mật khẩu mới.' }),
  })
  .refine((value) => value.newPassword === value.confirm, {
    path: ['confirm'],
    error: 'Mật khẩu nhập lại không khớp.',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    error: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  });
export type PasswordFormValue = z.infer<typeof PasswordFormSchema>;

export const EMPTY_PASSWORD_FORM: PasswordFormValue = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};
