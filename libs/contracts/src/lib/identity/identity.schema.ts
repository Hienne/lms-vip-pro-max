import { z } from 'zod';

// Mirrors lms-mockup/src/core/types.js. Display labels (e.g. Vietnamese role
// names) are UI copy and live in the app, not here.

export const RoleSchema = z.enum(['learner', 'instructor', 'admin', 'viewer']);
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
  role: RoleSchema,
  unitId: z.string(),
  groupId: z.string(),
  /** Unit id an admin is limited to; `null` means the whole system. */
  adminScope: z.string().nullable(),
  status: AccountStatusSchema,
  joinedAt: z.iso.datetime(),
  lastLoginAt: z.iso.datetime().nullable(),
  title: z.string(),
});
export type User = z.infer<typeof UserSchema>;
