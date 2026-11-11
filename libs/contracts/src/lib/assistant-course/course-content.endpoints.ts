import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  CourseContentSchema,
  CourseOutlineSchema,
  DecideQuestionCommandSchema,
} from './course-content.schema';
import { CourseJobSchema } from './course-job.schema';

const jobParams = z.object({ jobId: z.number().int() });
const lessonParams = jobParams.extend({ key: z.string() });
const questionParams = lessonParams.extend({ index: z.number().int().min(0) });

const base = '/api/v1/assistant/course-jobs/{jobId}';

/** The review of a course generation: only the owner of the job may call these. */
export const courseContentEndpoints = {
  content: defineEndpoint({
    method: 'get',
    path: `${base}/content`,
    params: jobParams,
    response: CourseContentSchema,
  }),
  /** Only before approval; afterwards the server answers `OUTLINE_LOCKED`. */
  updateOutline: defineEndpoint({
    method: 'put',
    path: `${base}/outline`,
    params: jobParams,
    body: CourseOutlineSchema,
    response: CourseContentSchema,
  }),
  /** Locks the outline and starts writing the lessons, then their questions. */
  approveOutline: defineEndpoint({
    method: 'post',
    path: `${base}/outline/approve`,
    params: jobParams,
    response: CourseContentSchema,
  }),
  /** Writes one lesson again; the others stay as they are. */
  regenerateLesson: defineEndpoint({
    method: 'post',
    path: `${base}/lessons/{key}/regenerate`,
    params: lessonParams,
    response: CourseContentSchema,
  }),
  decideQuestion: defineEndpoint({
    method: 'put',
    path: `${base}/questions/{key}/{index}`,
    params: questionParams,
    body: DecideQuestionCommandSchema,
    response: CourseContentSchema,
  }),
  /** Runs the failed steps again; the finished ones are kept. */
  retry: defineEndpoint({
    method: 'post',
    path: `${base}/retry`,
    params: jobParams,
    response: CourseContentSchema,
  }),
  /** Needs every lesson done; the course is a draft the author still reviews and publishes. */
  createDraft: defineEndpoint({
    method: 'post',
    path: `${base}/draft`,
    params: jobParams,
    response: CourseJobSchema,
  }),
} as const;
