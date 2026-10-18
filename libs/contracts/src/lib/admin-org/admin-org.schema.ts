import { z } from 'zod';
import { FunctionCodeSchema } from '../identity/identity.schema';
import { CourseStatusSchema } from '../learning/learning.schema';

// The parts of lms-mockup/src/api/admin.js the backend does not have. They stay on the mock API:
// the role editor (D2: roles are fixed by the backend, the screen is a prototype) and the
// courses, attempts and activity tabs of a user. The users, role grants, orgs and teams the
// backend does have live in `identity/` and `organization/`.

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
 * A role of the mock-only role screen: a named set of function codes. The backend has no role
 * CRUD, so this lives only in the mock API; the roles the grant forms read are `RoleOption`.
 */
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  system: z.boolean(),
  menus: z.array(FunctionCodeSchema),
  /** The mock server refuses to edit or delete the role. */
  locked: z.boolean(),
  /** Users holding the role; a role in use cannot be deleted. */
  userCount: z.number().int().nonnegative(),
});
export type Role = z.infer<typeof RoleSchema>;

/** Create (no `id`) or update the role named by `id`: its name, description and the screens it grants. */
export const SaveRoleCommandSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  menus: z.array(FunctionCodeSchema),
});
export type SaveRoleCommand = z.infer<typeof SaveRoleCommandSchema>;

export const DeleteRoleResultSchema = z.literal(true);
