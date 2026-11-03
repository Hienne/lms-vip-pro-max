import { z } from 'zod';
import {
  ASSIGNMENT_LIMITS,
  TargetInputSchema,
} from '../assignment/assignment.schema';

// The body of the publish command (`PublishRequest`): the version check alone, or with the
// assignment rows and the new shares that are applied in the same transaction. Kept apart from
// `course.schema.ts` because the assignment schemas already import that file.

export const PUBLISH_LIMITS = {
  /** Assignment rows per publish. */
  assignments: 20,
  /** Units shared per publish. */
  shares: 50,
} as const;

/** One assignment of the course being published; the server completes the rest of its values. */
export const PublishAssignmentSchema = z.object({
  startAt: z.iso.datetime({ offset: true }),
  dueAt: z.iso.datetime({ offset: true }).optional(),
  reminderEnabled: z.boolean(),
  reminderDaysBefore: z
    .number()
    .int()
    .min(0)
    .max(ASSIGNMENT_LIMITS.reminderDaysBefore),
  target: TargetInputSchema,
});
export type PublishAssignment = z.infer<typeof PublishAssignmentSchema>;

/**
 * Publishes a draft. `assignments` and `shareOrgIds` are all or nothing with the publish: one
 * refused row leaves the revision a draft and the refusal names the row (`assignments[i]`,
 * `shareOrgIds[j]`). `{ expectedVersion }` alone publishes as before.
 */
export const PublishCourseCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  assignments: z
    .array(PublishAssignmentSchema)
    .max(PUBLISH_LIMITS.assignments)
    .optional(),
  shareOrgIds: z
    .array(z.number().int().positive())
    .max(PUBLISH_LIMITS.shares)
    .optional(),
});
export type PublishCourseCommand = z.infer<typeof PublishCourseCommandSchema>;

/** The `field` of a refused row, such as `assignments[1]`, as its kind and index. */
export function publishRowOf(
  field: string,
): { kind: 'assignments' | 'shareOrgIds'; index: number } | undefined {
  const match = /^(assignments|shareOrgIds)\[(\d+)\]/.exec(field);
  return match
    ? {
        kind: match[1] as 'assignments' | 'shareOrgIds',
        index: Number(match[2]),
      }
    : undefined;
}
