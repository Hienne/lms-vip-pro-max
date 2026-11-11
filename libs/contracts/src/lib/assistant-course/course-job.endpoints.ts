import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  CourseJobSchema,
  CourseJobSummarySchema,
  StartCourseJobCommandSchema,
} from './course-job.schema';

const jobParams = z.object({ jobId: z.number().int() });

/** Course generation from a document: `/api/v1/assistant/course-jobs` (instructors and admins only). */
export const courseJobEndpoints = {
  /** Queues a job from an uploaded file. One job runs at a time server-wide; at most three a day each. */
  start: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/course-jobs',
    encoding: 'multipart',
    body: StartCourseJobCommandSchema,
    response: CourseJobSchema,
  }),
  /** The caller's jobs, newest first. */
  list: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/course-jobs',
    response: z.array(CourseJobSummarySchema),
  }),
  get: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/course-jobs/{jobId}',
    params: jobParams,
    response: CourseJobSchema,
  }),
  cancel: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/course-jobs/{jobId}/cancel',
    params: jobParams,
    response: CourseJobSchema,
  }),
  remove: defineEndpoint({
    method: 'delete',
    path: '/api/v1/assistant/course-jobs/{jobId}',
    params: jobParams,
    response: z.null(),
  }),
} as const;
