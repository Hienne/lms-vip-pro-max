import { type FunctionCode, SaveRoleCommandSchema } from '@lms/contracts';
import { z } from 'zod';

/** The role form: the contract's command with a required-name message. */
export const RoleFormSchema = z.object({
  name: SaveRoleCommandSchema.shape.name
    .trim()
    .min(1, { error: 'Nhập tên vai trò.' }),
  description: SaveRoleCommandSchema.shape.description,
  menus: SaveRoleCommandSchema.shape.menus,
});
export type RoleFormValue = z.infer<typeof RoleFormSchema>;

export function toRoleFormValue(
  role: {
    name: string;
    description: string;
    menus: readonly FunctionCode[];
  } | null,
): RoleFormValue {
  return {
    name: role?.name ?? '',
    description: role?.description ?? '',
    menus: [...(role?.menus ?? [])],
  };
}
