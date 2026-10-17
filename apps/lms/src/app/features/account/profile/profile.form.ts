import { PROFILE_LIMITS, type UpdateMeCommand, toPatch } from '@lms/contracts';
import { z } from 'zod';
import type { Profile } from '../../../core/session/profile';

/** What the personal form edits: three text fields, an empty optional one meaning "none". */
export interface ProfileFormValue {
  readonly fullName: string;
  readonly email: string;
  readonly positionName: string;
}

/**
 * The personal form: the backend's rules (`ProfileUpdateRequest`) with Vietnamese messages.
 * `fullName` is 1 to 255 characters and not blank; `email` is optional, at most 100 characters
 * and an address; `positionName` is optional, at most 255.
 */
export const ProfileFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'Nhập họ và tên.' })
    .max(PROFILE_LIMITS.fullName, {
      error: `Họ tên tối đa ${PROFILE_LIMITS.fullName} ký tự.`,
    }),
  email: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.email, {
      error: `Email tối đa ${PROFILE_LIMITS.email} ký tự.`,
    })
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      {
        error: 'Email không hợp lệ.',
      },
    ),
  positionName: z
    .string()
    .trim()
    .max(PROFILE_LIMITS.positionName, {
      error: `Chức danh tối đa ${PROFILE_LIMITS.positionName} ký tự.`,
    }),
});

const FIELDS = ['fullName', 'email', 'positionName'] as const;

/** Prefills the personal form from the signed-in user. */
export function toProfileFormValue(user: Profile | null): ProfileFormValue {
  return {
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    positionName: user?.positionName ?? '',
  };
}

/**
 * The PATCH body: only what differs from the signed-in user, an emptied optional field as `null`
 * (the backend clears it) and an untouched one left out (the backend keeps it).
 */
export function toUpdateMeCommand(
  user: Profile,
  value: ProfileFormValue,
): UpdateMeCommand {
  const blankToNull = (text: string) =>
    text.trim() === '' ? null : text.trim();
  return toPatch(
    {
      fullName: user.fullName,
      email: user.email,
      positionName: user.positionName,
    },
    {
      fullName: value.fullName.trim(),
      email: blankToNull(value.email),
      positionName: blankToNull(value.positionName),
    },
    FIELDS,
  );
}
