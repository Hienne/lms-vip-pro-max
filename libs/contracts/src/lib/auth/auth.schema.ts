import { z } from 'zod';
import { RoleSchema, UserSchema } from '../identity/identity.schema';

// Mirrors lms-mockup/src/api/auth.js. The mockup also returns `roleLabel`
// (Vietnamese role name); that is display copy, so the app derives it from
// `role` (+ `adminScope`) and the contract omits it.

/** Payload only; password and email rules are enforced by the server (422). */
export const LoginCommandSchema = z.object({
  email: z.string(),
  password: z.string(),
});
export type LoginCommand = z.infer<typeof LoginCommandSchema>;

/** Result of `login` and `loginDemo`. The session token travels as a cookie. */
export const LoginResultSchema = z.object({ id: z.string(), role: RoleSchema });
export type LoginResult = z.infer<typeof LoginResultSchema>;

/** Server-evaluated permissions per role (mockup `PERMS`). */
export const PermissionSchema = z.enum([
  'learn',
  'content.write',
  'question.write',
  'feedback.reply',
  'reports.read',
  'users.manage',
  'org.manage',
  'assign.manage',
  'system.manage',
]);
export type Permission = z.infer<typeof PermissionSchema>;

/** The signed-in user with names resolved and permissions evaluated by the server. */
export const ProfileSchema = UserSchema.extend({
  unitName: z.string(),
  groupName: z.string(),
  perms: z.array(PermissionSchema),
  /** Unit name the user is limited to, or the server's "whole system" label. */
  scopeName: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** One entry of the login screen's demo account list. */
export const DemoAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  /** Set for unit-scoped admins; the app labels them "unit admin". */
  adminScope: z.string().nullable(),
  /** Unit name. */
  unit: z.string(),
});
export type DemoAccount = z.infer<typeof DemoAccountSchema>;

/** `logout` answers `true`, as the mockup does. */
export const LogoutResultSchema = z.literal(true);
