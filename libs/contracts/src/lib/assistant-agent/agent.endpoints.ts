import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  ActionResultSchema,
  AgentCommandSchema,
  AgentStreamEventSchema,
} from './agent.schema';

/** The quick assistant: the backend's `/api/v1/assistant/agent`, new with the tool-calling chatbot. */
export const agentEndpoints = {
  /** One turn as NDJSON: `tool`, `delta`s, then `navigate`, `action_required` or `done`, or `error`. */
  stream: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/stream',
    body: AgentCommandSchema,
    responseType: 'ndjson',
    response: AgentStreamEventSchema,
  }),
  /** Runs a pending action as the signed-in user. */
  confirmAction: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/actions/{actionId}/confirm',
    params: z.object({ actionId: z.string() }),
    response: ActionResultSchema,
  }),
  /** Drops a pending action without running it. */
  cancelAction: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/agent/actions/{actionId}/cancel',
    params: z.object({ actionId: z.string() }),
    response: z.unknown(),
  }),
} as const;

/** "Giải thích" on one question of a graded attempt whose review shows the answers. */
export const quizExplainEndpoints = {
  /**
   * The explanation as NDJSON (`conversation`, `delta`s, then `done` with the lesson as a source, or
   * `error`). Refused before it starts unless the attempt is the caller's, submitted, and its quiz
   * shows answers (`ASSESSMENT-REVIEW_NOT_AVAILABLE`).
   */
  explain: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/quiz-attempts/{attemptId}/questions/{displayOrder}/explain',
    params: z.object({
      attemptId: z.number().int(),
      displayOrder: z.number().int(),
    }),
    responseType: 'ndjson',
    response: AgentStreamEventSchema,
  }),
} as const;
