import { z } from 'zod';

/**
 * The backend's `BaseResponse<T>` wrapper. Parsing yields `data`, so an endpoint declares
 * `response: envelope(DataSchema)` and callers never see the wrapper. A body without the
 * wrapper, or with a `data` that does not match, fails to parse. The backend's `errors`
 * and `messageCode` are not read (error mapping is deferred).
 */
export function envelope<T extends z.ZodType>(data: T) {
  return z
    .object({
      responseId: z.string(),
      timestamp: z.iso.datetime({ offset: true, local: true }),
      status: z.enum(['SUCCESS', 'ERROR']),
      messageCode: z.string(),
      message: z.string(),
      messageTitle: z.string(),
      data,
    })
    .transform((body) => (body as { data: z.output<T> }).data);
}
