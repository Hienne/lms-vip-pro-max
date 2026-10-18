import { z } from 'zod';

/**
 * The wrapper the backend (`BaseResponse`) puts around every response. `status` tells success
 * from failure and the payload of a success is in `data`. Validation and business failures are
 * HTTP 200 with `status: 'ERROR'`; authentication, permission, protocol and system failures use
 * their own HTTP status (400, 401, 403, 404, 405, 406, 415, 429, 500) with the same wrapper in
 * the body. A body `errors[]` (per-field details) is not read: forms show their own validators'
 * messages and a backend refusal is shown as a toast.
 */
export const EnvelopeSchema = z.object({
  responseId: z.string().nullish(),
  timestamp: z.string().nullish(),
  status: z.enum(['SUCCESS', 'ERROR']),
  /** `CORE-SUCCESS` on success; any other code is a failure. */
  messageCode: z.string(),
  messageTitle: z.string().nullish(),
  message: z.string().nullish(),
  /** Parsed later by the endpoint's own response schema. */
  data: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

/** The backend ended the session: the token is missing, expired or revoked (HTTP 401). */
export const UNAUTHENTICATED_CODE = 'CORE-UNAUTHENTICATED';
/** HTTP 403: the caller may not do this; the session stays. */
export const ACCESS_DENIED_CODE = 'CORE-ACCESS_DENIED';

/**
 * The message codes the app branches on, and the error kind each one means; a code here wins over
 * the HTTP status. Add a code here only when a screen must behave differently for it: every other
 * failure takes its kind from the status (`toAppError`) and shows the backend's own title and
 * message.
 */
export const MESSAGE_CODE_KIND = {
  [UNAUTHENTICATED_CODE]: 'unauthorized',
  [ACCESS_DENIED_CODE]: 'forbidden',
} as const;
