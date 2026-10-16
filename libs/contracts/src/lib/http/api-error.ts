import { z } from 'zod';

/**
 * Error body of every non-2xx response. Provisional: it mirrors the mockup's `ApiError` until
 * the backend publishes its error schema, so do not treat this shape as final.
 */
export const ApiErrorSchema = z.object({
  message: z.string(),
  /** Field name to message, present on 422 validation errors. */
  details: z.record(z.string(), z.string()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
