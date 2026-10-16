import {
  type SaveUserCommand,
  SaveUserCommandSchema,
  type UserListItem,
} from '@lms/contracts';
import { z } from 'zod';

/** The scope select's value for the whole system; the command carries `null` instead. */
export const WHOLE_SYSTEM = '';

/**
 * The user form: the contract's command with the mockup's Vietnamese messages. Whether the caller
 * may grant a role or a scope is the server's rule and arrives as a refusal toast.
 */
export const UserFormSchema = z.object({
  name: SaveUserCommandSchema.shape.name
    .trim()
    .min(2, { error: 'Họ tên tối thiểu 2 ký tự.' }),
  email: SaveUserCommandSchema.shape.email
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { error: 'Email không hợp lệ.' }),
  title: SaveUserCommandSchema.shape.title,
  unitId: SaveUserCommandSchema.shape.unitId.min(1, {
    error: 'Chọn đơn vị.',
  }),
  groupId: SaveUserCommandSchema.shape.groupId.min(1, {
    error: 'Chọn phòng / nhóm.',
  }),
  roleId: SaveUserCommandSchema.shape.roleId.min(1, {
    error: 'Chọn vai trò.',
  }),
  scope: z.string(),
});
export type UserFormValue = z.infer<typeof UserFormSchema>;

/** Prefills the form from the user being edited, or from the caller's unit for a new one. */
export function toUserFormValue(
  user: UserListItem | null,
  defaults: {
    readonly unitId: string;
    readonly roleId: string;
    readonly scopeUnitId: string | null;
  },
): UserFormValue {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    title: user?.title ?? '',
    unitId: user?.unitId ?? defaults.unitId,
    groupId: user?.groupId ?? '',
    roleId: user?.roleId ?? defaults.roleId,
    scope: (user ? user.scopeUnitId : defaults.scopeUnitId) ?? WHOLE_SYSTEM,
  };
}

export function toSaveUserCommand(
  id: string | undefined,
  value: UserFormValue,
): SaveUserCommand {
  return {
    ...(id ? { id } : {}),
    name: value.name.trim(),
    email: value.email.trim(),
    title: value.title.trim(),
    unitId: value.unitId,
    groupId: value.groupId,
    roleId: value.roleId,
    scopeUnitId: value.scope === WHOLE_SYSTEM ? null : value.scope,
  };
}
