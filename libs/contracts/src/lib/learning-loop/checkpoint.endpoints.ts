// Not in the mockup. The backend's in-lesson checkpoint API (corebanking-academy, ticket 01); see
// .scratch/learning-loop/spec.md, F1. Keep `served: 'mock'` until the backend that has it is deployed.
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  CheckpointAnswerBodySchema,
  CheckpointResultSchema,
  CheckpointSchema,
} from './checkpoint.schema';

const lessonParams = z.object({ lessonId: z.number().int() });

export const checkpointEndpoints = {
  /** Up to three ungraded recall questions of the lesson, without the key. */
  checkpoint: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/lessons/{lessonId}/checkpoint',
    params: lessonParams,
    response: CheckpointSchema,
    served: 'mock',
  }),
  /**
   * Grades one answer on the server and records it; no XP, completion or competency changes. A
   * question that changed is refused with `ASSESSMENT-CHECKPOINT_STALE`.
   */
  answerCheckpoint: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/lessons/{lessonId}/checkpoint/answers',
    params: lessonParams,
    body: CheckpointAnswerBodySchema,
    response: CheckpointResultSchema,
    served: 'mock',
  }),
} as const;
