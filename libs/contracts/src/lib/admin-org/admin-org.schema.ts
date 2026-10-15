import { z } from 'zod';
import {
  AccountStatusSchema,
  GroupSchema,
  RoleSchema,
  UnitSchema,
  UserSchema,
} from '../identity/identity.schema';
import { CourseStatusSchema } from '../learning/learning.schema';

// Mirrors the users part of lms-mockup/src/api/admin.js. Who may call these (the `users.manage`
// permission and the unit scope in the mockup) is the server's rule: here it is the `admin.users`
// menu, and the server still filters every list to the caller's `scopeUnitId`.

/** A row of the users list: the user with the names the server resolved. */
export const UserListItemSchema = UserSchema.extend({
  roleName: z.string(),
  unitName: z.string(),
  groupName: z.string(),
});
export type UserListItem = z.infer<typeof UserListItemSchema>;

/** One assigned course in the user's detail (mockup `courses` of `user()`). */
export const UserCourseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  required: z.boolean(),
  /** Server-computed progress, 0 to 100. */
  pct: z.number().int().min(0).max(100),
  status: CourseStatusSchema,
  overdue: z.boolean(),
  dueAt: z.iso.datetime().nullable(),
  lastAccessAt: z.iso.datetime().nullable(),
  quiz: z
    .object({
      best: z.number().int().nullable(),
      attempts: z.number().int().nonnegative(),
      maxAttempts: z.number().int().positive(),
    })
    .nullable(),
});
export type UserCourse = z.infer<typeof UserCourseSchema>;

export const UserAttemptSchema = z.object({
  id: z.string(),
  title: z.string(),
  score: z.number().int(),
  passed: z.boolean(),
  at: z.iso.datetime(),
});
export type UserAttempt = z.infer<typeof UserAttemptSchema>;

export const AuditEntrySchema = z.object({
  id: z.string(),
  at: z.iso.datetime(),
  userId: z.string(),
  action: z.string(),
  target: z.string(),
  detail: z.string(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/**
 * The user page. The mockup also returns `competency` (the radar) and `perms`; the radar is
 * migrated with the charts, and `perms` became the role below with the menus it grants.
 */
export const UserDetailSchema = z.object({
  user: UserListItemSchema,
  role: RoleSchema,
  courses: z.array(UserCourseSchema),
  attempts: z.array(UserAttemptSchema),
  audit: z.array(AuditEntrySchema),
});
export type UserDetail = z.infer<typeof UserDetailSchema>;

/** Create (no `id`) or update (with `id`) a user, as the mockup's `saveUser`. */
export const SaveUserCommandSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  email: z.string(),
  title: z.string(),
  unitId: z.string(),
  groupId: z.string(),
  roleId: z.string(),
  /** Unit the user's data access is limited to; `null` is the whole system. */
  scopeUnitId: z.string().nullable(),
});
export type SaveUserCommand = z.infer<typeof SaveUserCommandSchema>;

export const SetUserStatusCommandSchema = z.object({
  status: AccountStatusSchema,
});
export type SetUserStatusCommand = z.infer<typeof SetUserStatusCommandSchema>;

/** `resetPassword` says where the reset link went. */
export const ResetPasswordResultSchema = z.object({ sentTo: z.string() });
export type ResetPasswordResult = z.infer<typeof ResetPasswordResultSchema>;

/**
 * What the user form and the org screens need to fill their selects (mockup `meta`), already cut
 * to the caller: a unit-scoped caller sees one unit and only the roles it may assign.
 */
export const AdminMetaSchema = z.object({
  /** Units the caller may place users in. */
  units: z.array(UnitSchema),
  /** Every unit, for naming a scope. */
  allUnits: z.array(UnitSchema),
  groups: z.array(GroupSchema),
  /** Roles the caller may assign. */
  roles: z.array(RoleSchema),
});
export type AdminMeta = z.infer<typeof AdminMetaSchema>;
