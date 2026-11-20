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
  /**
   * Retired: the backend answers every call with HTTP 410 `ASSISTANT-COURSE_JOBS_RETIRED` ("Soạn
   * cùng trợ lý" replaced it, ADR 0002). Kept only so the mock can answer it; the app never calls
   * it (`old-job-start.spec.ts`). Jobs started before still run and every other endpoint here works.
   */
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
  /**
   * The caller's running jobs plus the ones that failed or were stopped in the last days, each
   * with its `courseId`: what the app reads on start so a reload keeps progress and failure notices.
   */
  active: defineEndpoint({
    method: 'get',
    path: '/api/v1/assistant/course-jobs/active',
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
  /**
   * Stops a job that has not finished (status `stopped`): written lessons stay, the others become
   * empty `pending` lessons the author fills by hand.
   */
  stop: defineEndpoint({
    method: 'post',
    path: '/api/v1/assistant/course-jobs/{jobId}/stop',
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
