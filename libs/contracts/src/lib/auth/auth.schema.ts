import { z } from 'zod';
import { MenuKeySchema, UserSchema } from '../identity/identity.schema';

// Mirrors lms-mockup/src/api/auth.js. Roles are data here (a named set of menus), so the profile
// carries the role's name and the menus it grants instead of the mockup's fixed `PERMS`.

/** Payload only; password and email rules are enforced by the server (422). */
export const LoginCommandSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginCommand = z.infer<typeof LoginCommandSchema>;

/** Result of `login` and `loginDemo`. The session token travels as a cookie. */
export const LoginResultSchema = z.object({
  id: z.string(),
  roleId: z.string(),
});
export type LoginResult = z.infer<typeof LoginResultSchema>;

/** The signed-in user with names resolved and menus evaluated by the server. */
export const ProfileSchema = UserSchema.extend({
  unitName: z.string(),
  groupName: z.string(),
  roleName: z.string(),
  /** Menus the user's role grants; every other screen answers 403. */
  menus: z.array(MenuKeySchema),
  /** Where `/` and the login page send the user: the first granted menu, else `/profile`. */
  homePath: z.string(),
  /** Unit name the user is limited to, or the server's "whole system" label. */
  scopeName: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** One entry of the login screen's demo account list. */
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

/** `logout` answers `true`, as the mockup does. */
export const LogoutResultSchema = z.literal(true);
