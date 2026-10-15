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

// The units and groups part of lms-mockup/src/api/admin.js (`org`, `saveUnit`, `setUnitStatus`,
// `saveGroup`, `deleteGroup`). Who may call them is the `admin.org` menu; the server also cuts the
// list to the caller's `scopeUnitId` and refuses to let a unit-limited caller create a unit.

/** A member shown under a group (mockup `groups[].members`). */
export const GroupMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  /** Unit the member's data access is limited to; marks an administrator limited to one unit. */
  scopeUnitId: z.string().nullable(),
});
export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const OrgGroupSchema = GroupSchema.extend({
  members: z.array(GroupMemberSchema),
});
export type OrgGroup = z.infer<typeof OrgGroupSchema>;

/** Who administers a unit: someone limited to it, or a whole-system administrator placed in it. */
export const UnitAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(['unit', 'system']),
});
export type UnitAdmin = z.infer<typeof UnitAdminSchema>;

/** A unit with everything the org screen shows about it (mockup `org()` rows). */
export const OrgUnitSchema = UnitSchema.extend({
  admins: z.array(UnitAdminSchema),
  /** People in the unit, across all its groups. */
  members: z.number().int().nonnegative(),
  groups: z.array(OrgGroupSchema),
  /** Courses another unit owns and shared with this one. */
  sharedCourses: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type OrgUnit = z.infer<typeof OrgUnitSchema>;

/** Create (no `id`) or rename the unit named by `id`. */
export const SaveUnitCommandSchema = z.object({
  id: z.string().optional(),
  code: z.string(),
  name: z.string(),
});
export type SaveUnitCommand = z.infer<typeof SaveUnitCommandSchema>;

export const SetUnitStatusCommandSchema = z.object({
  status: UnitSchema.shape.status,
});
export type SetUnitStatusCommand = z.infer<typeof SetUnitStatusCommandSchema>;

/** Create (no `id`) or rename a group; the kind stays what it was when omitted (`team` for a new one). */
export const SaveGroupCommandSchema = z.object({
  id: z.string().optional(),
  unitId: z.string(),
  name: z.string(),
  kind: GroupSchema.shape.kind.optional(),
});
export type SaveGroupCommand = z.infer<typeof SaveGroupCommandSchema>;

export const DeleteGroupResultSchema = z.literal(true);
