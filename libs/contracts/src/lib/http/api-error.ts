import { z } from 'zod';

/** Error body of every non-2xx response; mirrors the mockup's `ApiError`. */
export const ApiErrorSchema = z.object({
  message: z.string(),
  /** Field name to message, present on 422 validation errors. */
  details: z.record(z.string(), z.string()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
