import { RoleSchema } from '@lms/contracts';
import { z } from 'zod';

/** What the role guard hands the 403 page through navigation state. */
export const ForbiddenStateSchema = z.object({
  path: z.string(),
  roles: z.array(RoleSchema),
});
export type ForbiddenState = z.infer<typeof ForbiddenStateSchema>;
