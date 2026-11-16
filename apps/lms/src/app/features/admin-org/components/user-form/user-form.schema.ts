import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
  toPatch,
  USER_LIMITS,
  type CreateUserCommand,
  type GrantRequest,
  type UpdateUserCommand,
  type UserInfo,
} from '@lms/contracts';
import { z } from 'zod';

/** The user being edited: the fields the edit form starts from. Both list rows and `/users/{id}` fit. */
export type ManagedUser = Pick<
  UserInfo,
  | 'userId'
  | 'username'
  | 'fullName'
  | 'email'
  | 'positionName'
  | 'orgId'
  | 'teamId'
>;

/**
 * The add/edit form of a user: the backend's rules (`CreateUserRequest`, `UserUpdateRequest`) with
 * Vietnamese messages. In edit mode the account fields (`userId`, `username`, `initialPassword`)
 * are hidden, so their rules do not apply. `orgId` and `teamId` are select values: `''` means none.
 */
export const UserFormSchema = z.object({
  userId: z.string().trim().regex(USER_LIMITS.userIdPattern, {
    error:
      'Mã cán bộ gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (tối đa 20).',
  }),
  username: z.string().trim().regex(USER_LIMITS.usernamePattern, {
    error:
      'Tên đăng nhập gồm chữ, số, dấu chấm, gạch dưới, gạch ngang (tối đa 100).',
  }),
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'Nhập họ và tên.' })
    .max(USER_LIMITS.fullName, {
      error: `Họ tên tối đa ${USER_LIMITS.fullName} ký tự.`,
    }),
  email: z
    .string()
    .trim()
    .max(USER_LIMITS.email, {
      error: `Email tối đa ${USER_LIMITS.email} ký tự.`,
    })
    .refine(
      (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      { error: 'Email không hợp lệ.' },
    ),
  positionName: z
    .string()
    .trim()
    .max(USER_LIMITS.positionName, {
      error: `Chức danh tối đa ${USER_LIMITS.positionName} ký tự.`,
    }),
  orgId: z.string(),
  teamId: z.string(),
  initialPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, {
      error: `Mật khẩu tạm tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`,
    })
    .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, {
      error: 'Mật khẩu quá dài. Vui lòng rút ngắn và thử lại.',
    }),
});
export type UserFormValue = z.infer<typeof UserFormSchema>;

const idOf = (value: string): number | undefined =>
  value === '' ? undefined : Number(value);

/** Prefills the form from the user being edited; a new user starts in the caller's org, if any. */
export function toUserFormValue(
  user: ManagedUser | null,
  defaultOrgId: number | null,
): UserFormValue {
  const orgId = user ? user.orgId : defaultOrgId;
  return {
    userId: user?.userId ?? '',
    username: user?.username ?? '',
    fullName: user?.fullName ?? '',
    email: user?.email ?? '',
    positionName: user?.positionName ?? '',
    orgId: orgId == null ? '' : String(orgId),
    teamId: user?.teamId == null ? '' : String(user.teamId),
    initialPassword: '',
  };
}

const blankToUndefined = (text: string) =>
  text.trim() === '' ? undefined : text.trim();

export function toCreateUserCommand(
  value: UserFormValue,
  grants: readonly GrantRequest[],
): CreateUserCommand {
  return {
    userId: value.userId.trim(),
    username: value.username.trim(),
    fullName: value.fullName.trim(),
    email: blankToUndefined(value.email),
    positionName: blankToUndefined(value.positionName),
    orgId: idOf(value.orgId),
    teamId: idOf(value.teamId),
    initialPassword: value.initialPassword,
    ...(grants.length ? { initialRoleGrants: [...grants] } : {}),
  };
}

const PATCH_FIELDS = [
  'fullName',
  'email',
  'positionName',
  'orgId',
  'teamId',
] as const;

/**
 * The PATCH body of an edit: only what differs from the user, an emptied optional field as `null`
 * (the backend clears it). Moving to another org also clears the team the form dropped.
 */
export function toUpdateUserCommand(
  user: ManagedUser,
  value: UserFormValue,
): UpdateUserCommand {
  const blankToNull = (text: string) =>
    text.trim() === '' ? null : text.trim();
  return toPatch(
    {
      fullName: user.fullName,
      email: user.email ?? null,
      positionName: user.positionName ?? null,
      orgId: user.orgId ?? null,
      teamId: user.teamId ?? null,
    },
    {
      fullName: value.fullName.trim(),
      email: blankToNull(value.email),
      positionName: blankToNull(value.positionName),
      orgId: idOf(value.orgId) ?? null,
      teamId: idOf(value.teamId) ?? null,
    },
    PATCH_FIELDS,
  );
}
