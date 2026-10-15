import { z } from 'zod';

// Mirrors lms-mockup/src/core/types.js. Display labels (e.g. Vietnamese role
// names) are UI copy and live in the app, not here.

/**
 * One key per sidebar entry. Access is granted per menu: a role that lists a key may open that
 * screen and its sub-routes and do everything on it. Display labels live in the app.
 */
export const MenuKeySchema = z.enum([
  'learn.home',
  'learn.catalog',
  'learn.progress',
  'learn.leaderboard',
  'learn.assistant',
  'learn.flashcards',
  'learn.saved',
  'learn.certificates',
  'teach.home',
  'teach.inbox',
  'content.catalog',
  'content.courses',
  'content.questions',
  'content.quizzes',
  'content.import',
  'admin.home',
  'admin.users',
  'admin.org',
  'admin.roles',
  'admin.assignments',
  'admin.system',
  'reports',
]);
export type MenuKey = z.infer<typeof MenuKeySchema>;

/**
 * A role is a named set of menus. `learner`, `instructor`, `admin` and `viewer` are the system
 * roles seeded from the mockup; the server forbids deleting them and locks `admin` entirely.
 */
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  system: z.boolean(),
  menus: z.array(MenuKeySchema),
  /** The server refuses to edit or delete the role (the `admin` system role). */
  locked: z.boolean(),
  /** Users holding the role; a role in use cannot be deleted. */
  userCount: z.number().int().nonnegative(),
});
export type Role = z.infer<typeof RoleSchema>;

export const AccountStatusSchema = z.enum(['active', 'suspended', 'locked']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const PublishStatusSchema = z.enum([
  'draft',
  'published',
  'paused',
  'locked',
]);
export type PublishStatus = z.infer<typeof PublishStatusSchema>;

export const UnitSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(['active', 'paused']),
});
export type Unit = z.infer<typeof UnitSchema>;

export const GroupSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string(),
  kind: z.enum(['department', 'team']),
});
export type Group = z.infer<typeof GroupSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  staffCode: z.string(),
  roleId: z.string(),
  unitId: z.string(),
  groupId: z.string(),
  /** Unit id the user's data access is limited to; `null` means the whole system. */
  scopeUnitId: z.string().nullable(),
  status: AccountStatusSchema,
  joinedAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  title: z.string(),
});
export type User = z.infer<typeof UserSchema>;
