import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  LessonCommentViewSchema,
  FeedbackViewSchema,
  LessonCommentsQuerySchema,
  LessonFeedbackSchema,
  LessonRatingResultSchema,
  RateLessonCommandSchema,
  SendFeedbackCommandSchema,
} from './feedback.schema';

const lessonParams = z.object({ lessonId: z.number().int() });
const LEARNING = '/api/v1/me/learning';

/**
 * A learner's rating, comments, questions and reports on a lesson (lms-mockup/src/api/learner.js,
 * `feedback`). The caller must hold the lesson through an enrolment; any other lesson answers
 * `LEARNING-NOT_FOUND`.
 */
export const feedbackEndpoints = {
  /** The section under a lesson: rating, the caller's stars, the first 20 comments, the caller's own questions and reports. */
  lessonFeedback: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/lessons/{lessonId}/feedback`,
    params: lessonParams,
    response: LessonFeedbackSchema,
  }),
  /** Save the caller's 1 to 5 stars on the lesson, replacing the last ones. */
  rateLesson: defineEndpoint({
    method: 'put',
    path: `${LEARNING}/lessons/{lessonId}/rating`,
    params: lessonParams,
    body: RateLessonCommandSchema,
    response: LessonRatingResultSchema,
  }),
  /**
   * Send a comment (public), a question or a report (both private to the sender), with the position
   * the learner is at. More than 20 sends on one lesson in a learning day answer `LEARNING-FEEDBACK_LIMIT`.
   */
  sendFeedback: defineEndpoint({
    method: 'post',
    path: `${LEARNING}/lessons/{lessonId}/feedback`,
    params: lessonParams,
    body: SendFeedbackCommandSchema,
    response: FeedbackViewSchema,
  }),
  /** A page of the lesson's comments, newest first, for "Xem thêm nhận xét". */
  lessonComments: defineEndpoint({
    method: 'get',
    path: `${LEARNING}/lessons/{lessonId}/comments`,
    params: lessonParams,
    query: LessonCommentsQuerySchema,
    response: PageSchema(LessonCommentViewSchema),
  }),
} as const;
