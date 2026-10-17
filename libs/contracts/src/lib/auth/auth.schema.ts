import { z } from 'zod';
import { MenuKeySchema, UserSchema } from '../identity/identity.schema';

// Mirrors lms-mockup/src/api/auth.js. Roles are data here (a named set of menus), so the profile
// carries the role's name and the menus it grants instead of the mockup's fixed `PERMS`.

/** Personal fields only: role, unit and scope are managed by administrators and ignored here. */
export const UpdateProfileCommandSchema = z.object({
  name: z.string(),
  title: z.string(),
});
export type UpdateProfileCommand = z.infer<typeof UpdateProfileCommandSchema>;

export const ChangePasswordCommandSchema = z.object({
  /** Current password. */
  cur: z.string(),
  next: z.string(),
  confirm: z.string(),
});
export type ChangePasswordCommand = z.infer<typeof ChangePasswordCommandSchema>;

/** `changePassword` answers `true`, as the mockup does. */
export const ChangePasswordResultSchema = z.literal(true);

/** The signed-in user as the app renders it; built from `/me` by `toProfile`. */
export const ProfileSchema = UserSchema.extend({
  unitName: z.string(),
  groupName: z.string(),
  roleName: z.string(),
  /** Menus the user may open (every menu until permissions are mapped). */
  menus: z.array(MenuKeySchema),
  /** Where `/` and the login page send the user (`/learn` until permissions are mapped). */
  homePath: z.string(),
  /** Label of the user's data scope (see `toProfile`). */
  scopeName: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** One entry of the dev toolbar's mock-role list (mock only; the backend has no such endpoint). */
export const DemoAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  /** Set for accounts limited to one unit; the app labels them "unit …". */
  scopeUnitId: z.string().nullable(),
  /** Unit name. */
  unit: z.string(),
});
export type DemoAccount = z.infer<typeof DemoAccountSchema>;
