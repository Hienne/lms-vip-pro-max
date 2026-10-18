import { FunctionCodeSchema } from '@lms/contracts';
import { z } from 'zod';

/** What the menu guard hands the 403 page through navigation state. */
export const ForbiddenStateSchema = z.object({
  path: z.string(),
  menu: FunctionCodeSchema,
});
export type ForbiddenState = z.infer<typeof ForbiddenStateSchema>;
