import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  CourseCardSchema,
  CourseListQuerySchema,
} from '../course/course.schema';
import {
  CourseEnrollmentSchema,
  EnrollmentDetailSchema,
  LearningReminderSchema,
  OpenSessionCommandSchema,
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
    query: CourseListQuerySchema,
    response: PageSchema(CourseCardSchema),
  }),
  /** One card per course at its current cycle, with the obligation and due date from real assignments. */
  myCourses: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/courses',
    query: CourseListQuerySchema,
    response: PageSchema(CourseCardSchema),
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
