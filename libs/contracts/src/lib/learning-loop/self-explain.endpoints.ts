// Not in the mockup. The backend's "Giải thích lại bằng lời của bạn" (corebanking-academy, ticket 03);
// see .scratch/learning-loop/spec.md, F2. Keep `served: 'mock'` until the backend that has it is deployed.
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { AgentStreamEventSchema } from '../assistant-agent/agent.schema';

/** The server accepts this many characters, after trimming. */
export const SELF_EXPLAIN_MIN_LENGTH = 50;
export const SELF_EXPLAIN_MAX_LENGTH = 1500;

/** Refused before the stream: the lesson has no text to compare with. */
export const LESSON_TEXT_UNAVAILABLE_CODE = 'ASSISTANT-LESSON_TEXT_UNAVAILABLE';

export const SelfExplainBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(SELF_EXPLAIN_MIN_LENGTH)
    .max(SELF_EXPLAIN_MAX_LENGTH),
});
export type SelfExplainBody = z.infer<typeof SelfExplainBodySchema>;

export const selfExplainEndpoints = {
  /**
   * The assistant's comparison of what the learner wrote with the lesson, as NDJSON (`conversation`,
   * `delta`s, then `done` with three sections and the lesson chunks as sources, or `error`).
   */
  selfExplain: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/lessons/{lessonId}/self-explain',
    params: z.object({ lessonId: z.number().int() }),
    body: SelfExplainBodySchema,
    responseType: 'ndjson',
    response: AgentStreamEventSchema,
    served: 'mock',
  }),
} as const;
