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
  // The study session protocol: valid requests the server cannot apply as sent. The player reads
  // the code and acts (claim again, ask to take over, reload); none of them is a system failure.
  'LEARNING-SESSION_IN_USE': 'refused',
  'LEARNING-SESSION_EXPIRED': 'refused',
  'LEARNING-STALE_EVENT': 'refused',
  'LEARNING-CONFLICT': 'refused',
  'LEARNING-MEDIA_CHANGED': 'refused',
  'LEARNING-ASSET_PROCESSING': 'refused',
  'LEARNING-NOT_AVAILABLE': 'refused',
  // The chunked upload: the author acts on each (pick the file again, upload again, pick another
  // file), and the row says so; a library file a course uses cannot be deleted.
  'LEARNING-UPLOAD_FILE_MISMATCH': 'refused',
  'LEARNING-UPLOAD_EXPIRED': 'refused',
  'LEARNING-UPLOAD_PART_CONFLICT': 'refused',
  'LEARNING-ASSET_INVALID': 'refused',
  'LEARNING-ASSET_CODEC_UNSUPPORTED': 'refused',
  'LEARNING-ASSET_IN_USE': 'refused',
  // A share with the course's own unit, or with a unit that does not exist.
  'LEARNING-INVALID_REFERENCE': 'refused',
  // Publishing a course whose final exam quiz is not published: the author publishes the quiz first.
  'LEARNING-FINAL_EXAM_UNPUBLISHED': 'refused',
  // A course code already in use: the create form shows it on the code field.
  'LEARNING-DUPLICATE': 'refused',
  // Community: valid requests the server cannot apply as sent. A stale version
  // (`COMMUNITY-CONFLICT`) opens the reload dialog and is never retried with the new version.
  'COMMUNITY-CONFLICT': 'refused',
  'COMMUNITY-IDEMPOTENCY_CONFLICT': 'refused',
  'COMMUNITY-DUPLICATE': 'refused',
  'COMMUNITY-STATE_INVALID': 'refused',
  'COMMUNITY-ACCEPT_INVALID': 'refused',
  'COMMUNITY-NOT_PUBLISHABLE': 'refused',
  'COMMUNITY-SELF_VOTE': 'refused',
  'COMMUNITY-INVALID_REFERENCE': 'refused',
  'COMMUNITY-ASSET_INVALID': 'refused',
  'COMMUNITY-ASSET_NOT_READY': 'refused',
  'COMMUNITY-UPLOAD_BUSY': 'refused',
  'COMMUNITY-UPLOAD_FILE_MISMATCH': 'refused',
  'COMMUNITY-MEDIA_UNAVAILABLE': 'refused',
  'COMMUNITY-JOB_UNAVAILABLE': 'refused',
  'COMMUNITY-DIGEST_UNAVAILABLE': 'refused',
  'COMMUNITY-CLEANUP_UNAVAILABLE': 'refused',
} as const;

/** The code that means someone else changed the content: the screen offers a reload. */
export const COMMUNITY_CONFLICT_CODE = 'COMMUNITY-CONFLICT';
