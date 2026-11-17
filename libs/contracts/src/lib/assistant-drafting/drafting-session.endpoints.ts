import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  ConfirmDraftingStepCommandSchema,
  DraftingSessionSchema,
  DraftingSourceSchema,
  DraftingStepNumberSchema,
  StartDraftingCommandSchema,
  UploadDraftingSourceCommandSchema,
} from './drafting-session.schema';

const sessionParams = z.object({ sessionId: z.number().int() });
const stepParams = sessionParams.extend({ step: DraftingStepNumberSchema });

/**
 * Drafting sessions ("Soạn cùng trợ lý"): `/api/v1/assistant/drafting-sessions`, instructors and
 * admins with the assistant function only. No mockup file: the backend (corebanking-academy
 * `CourseDraftingController`) is the spec. Every endpoint is `served: 'mock'` until it is deployed;
 * drop that word per endpoint then.
 */
export const draftingSessionEndpoints = {
  /** Starts a session from an uploaded document; step 1 begins `proposing`. Counts against the daily course-generation limit. */
  start: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions',
    encoding: 'multipart',
    body: StartDraftingCommandSchema,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
  /** Uploads the chat's attachment as a private source, not yet linked to a session. */
  uploadSource: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions/sources',
    encoding: 'multipart',
    body: UploadDraftingSourceCommandSchema,
    response: DraftingSourceSchema,
    served: 'mock',
  }),
  /** The caller's session; another user's id is not found. Polled while a step is `proposing`. */
  get: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/drafting-sessions/{sessionId}',
    params: sessionParams,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
  /** The latest session of a course, or null: how the editor resumes after a reload. */
  forCourse: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/drafting-sessions/course/{courseId}',
    params: z.object({ courseId: z.number().int() }),
    response: DraftingSessionSchema.nullable(),
    served: 'mock',
  }),
  /**
   * Confirms the current step with the page's values (body by step: `{course}`, `{draft}`,
   * `{draft, competencyId, questions}`, `{}`) and starts the next one. A taken course code is
   * `LEARNING-DUPLICATE`, and the session then proposes a new code.
   */
  confirm: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions/{sessionId}/steps/{step}/confirm',
    params: stepParams,
    body: ConfirmDraftingStepCommandSchema,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
  /** Proposes a `proposed`, `confirmed` or `failed` step again; other steps and the course stay. */
  proposeAgain: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions/{sessionId}/steps/{step}/propose-again',
    params: stepParams,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
  /** The author fills this step and the rest by hand; the assistant proposes nothing more. */
  manual: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions/{sessionId}/steps/{step}/manual',
    params: stepParams,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
  /** Stops the running step: it keeps what exists (`proposed`), or becomes `manual`. */
  stop: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/drafting-sessions/{sessionId}/stop',
    params: sessionParams,
    response: DraftingSessionSchema,
    served: 'mock',
  }),
} as const;
