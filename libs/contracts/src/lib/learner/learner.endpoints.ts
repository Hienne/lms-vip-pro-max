import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import { CourseCardSchema } from '../course/course.schema';
import {
  CourseEnrollmentSchema,
  EnrollmentDetailSchema,
  LearnerCourseSchema,
  LearnerFacetsSchema,
  LearningProgressOverviewSchema,
  LearningReminderSchema,
  MyCoursesQuerySchema,
  OpenSessionCommandSchema,
  ProgressExportQuerySchema,
  ProgressResultSchema,
  SaveProgressCommandSchema,
  StudySessionSchema,
} from './learner.schema';

const enrollmentParams = z.object({ enrollmentId: z.number().int() });

/** The backend's learner endpoints (/api/v1/me/learning). Keys follow lms-mockup/src/api/learner.js. */
export const learnerEndpoints = {
  /** Courses assigned to the caller plus the ones they may discover and have not joined. */
  catalog: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/catalog',
    query: MyCoursesQuerySchema,
    response: PageSchema(CourseCardSchema),
  }),
  /** One card per course at its current cycle, with the obligation and due date from real assignments. */
  myCourses: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/courses',
    query: MyCoursesQuerySchema,
    response: PageSchema(CourseCardSchema),
  }),
  /**
   * One course the caller can see, with its card and content. Enrolled: the revision they received.
   * Not enrolled: the published revision with every lesson's `blocks` empty. A course outside the
   * caller's scope answers `LEARNING-NOT_FOUND`.
   */
  course: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/courses/{courseId}',
    params: z.object({ courseId: z.number().int() }),
    response: LearnerCourseSchema,
  }),
  /** The fields, programmes and modules a visible course uses: what the catalogue's selects list. */
  facets: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/facets',
    response: LearnerFacetsSchema,
  }),
  /** Counts over the caller's current cycles, whatever the table below filters. */
  progressSummary: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/progress/summary',
    response: LearningProgressOverviewSchema,
  }),
  /**
   * A CSV (UTF-8 with BOM) of the rows `myCourses` lists for the same filters and sort, up to
   * 10,000. A refusal such as `LEARNING-EXPORT_TOO_LARGE` comes as a JSON envelope instead of the
   * file; `envelopeInterceptor` turns it into an `ApiError`.
   */
  exportProgress: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/progress/export',
    query: ProgressExportQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
  /** Self-enrols in a published, optional course the caller may discover. */
  enroll: defineEndpoint({
    method: 'post',
    path: '/api/v1/courses/{courseId}/enrollments',
    params: z.object({ courseId: z.number().int() }),
    response: CourseEnrollmentSchema,
  }),
  /** The caller's own enrolment: content, progress and where to resume. */
  enrollment: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/enrollments/{enrollmentId}',
    params: enrollmentParams,
    response: EnrollmentDetailSchema,
  }),
  /**
   * Claims the account's one study session on a block (a lease, a fence that rises on every
   * takeover) and sets the HttpOnly `academy_media` cookie the content URLs need. A second
   * device is refused with `LEARNING-SESSION_IN_USE` until it asks with `takeover: true`.
   */
  openSession: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/learning/sessions',
    body: OpenSessionCommandSchema,
    response: StudySessionSchema,
  }),
  /**
   * Records one interaction inside the claimed session; the server recomputes block, lesson and
   * course progress and answers the session receipt.
   */
  saveProgress: defineEndpoint({
    method: 'put',
    path: '/api/v1/me/learning/enrollments/{enrollmentId}/blocks/{blockId}/progress',
    params: enrollmentParams.extend({ blockId: z.number().int() }),
    body: SaveProgressCommandSchema,
    response: ProgressResultSchema,
  }),
  /** In-app reminders for obligations still due. */
  reminders: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/reminders',
    response: z.array(LearningReminderSchema),
  }),
  markReminderRead: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/learning/reminders/{reminderId}/read',
    params: z.object({ reminderId: z.number().int() }),
    response: LearningReminderSchema,
  }),
} as const;
