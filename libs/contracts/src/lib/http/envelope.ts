import { z } from 'zod';

/**
 * The wrapper the backend puts around every response. It answers HTTP 200 whatever the outcome:
 * `status` tells success from failure, and the payload of a success is in `data`.
 */
export const EnvelopeSchema = z.object({
  responseId: z.string().nullish(),
  timestamp: z.string().nullish(),
  status: z.enum(['SUCCESS', 'ERROR']),
  /** `CORE-0000` on success; any other code is a failure. */
  messageCode: z.string(),
  messageTitle: z.string().nullish(),
  message: z.string().nullish(),
  /** Parsed later by the endpoint's own response schema. */
  data: z.unknown(),
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

/** The backend ended the session: the token is missing, expired or invalid. */
export const UNAUTHENTICATED_CODE = 'CORE-0401';

/**
 * The message codes the app branches on, and the error kind each one means. Add a code here only
 * when a screen must behave differently for it; every other failure is a plain `server` error
 * that shows the backend's own title and message.
 */
export const MESSAGE_CODE_KIND = {
  [UNAUTHENTICATED_CODE]: 'unauthorized',
} as const;
