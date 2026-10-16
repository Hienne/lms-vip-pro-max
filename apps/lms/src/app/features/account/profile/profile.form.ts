import {
  ChangePasswordCommandSchema,
  type UpdateProfileCommand,
  UpdateProfileCommandSchema,
} from '@lms/contracts';
import type { Profile } from '@lms/contracts';

/**
 * The profile forms: the contract's command schemas with the mockup's Vietnamese messages. Only
 * shape rules live here; password strength is a server rule and arrives as a refusal toast.
 */
export const ProfileFormSchema = UpdateProfileCommandSchema.extend({
  name: UpdateProfileCommandSchema.shape.name
    .trim()
    .min(2, { error: 'Họ tên tối thiểu 2 ký tự.' }),
});

export const PasswordFormSchema = ChangePasswordCommandSchema.extend({
  cur: ChangePasswordCommandSchema.shape.cur.min(1, {
    error: 'Nhập mật khẩu hiện tại.',
  }),
  next: ChangePasswordCommandSchema.shape.next.min(1, {
    error: 'Nhập mật khẩu mới.',
  }),
  confirm: ChangePasswordCommandSchema.shape.confirm.min(1, {
    error: 'Nhập lại mật khẩu mới.',
  }),
}).refine((value) => value.next === value.confirm, {
  path: ['confirm'],
  error: 'Mật khẩu nhập lại không khớp.',
});

export const EMPTY_PASSWORD_FORM = { cur: '', next: '', confirm: '' } as const;

/** Prefills the personal form from the signed-in user. */
export function toProfileFormValue(
  user: Pick<Profile, 'name' | 'title'> | null,
): UpdateProfileCommand {
  return { name: user?.name ?? '', title: user?.title ?? '' };
}

export function toUpdateProfileCommand(
  value: UpdateProfileCommand,
): UpdateProfileCommand {
  return { name: value.name.trim(), title: value.title.trim() };
}
