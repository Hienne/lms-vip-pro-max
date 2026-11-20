// Not in the mockup. The backend's competency review (corebanking-academy, ticket 05); see
// .scratch/learning-loop/spec.md, F3. Keep `served: 'mock'` until the backend that has it is deployed.
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';

export const ReviewLessonSchema = z.object({
  courseId: z.number().int(),
  courseTitle: z.string(),
  lessonId: z.number().int(),
  lessonTitle: z.string(),
  /** Missed exam questions plus missed quick questions of this lesson in the last 90 days. */
  missedCount: z.number().int().min(1),
  lastMissedAt: z.iso.datetime({ offset: true }),
});
export type ReviewLesson = z.infer<typeof ReviewLessonSchema>;

/** A weak competency (percent below 70, the server's) and the lessons its mistakes come from. */
export const CompetencyReviewSchema = z.object({
  competencyId: z.number().int(),
  name: z.string(),
  percent: z.number(),
  lessons: z.array(ReviewLessonSchema).max(3),
});
export type CompetencyReview = z.infer<typeof CompetencyReviewSchema>;

export const competencyReviewEndpoints = {
  /** The caller's weak competencies, weakest first, each with up to three lessons to review. */
  review: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/competency/review',
    query: z.object({
      competencyId: z.number().int().optional(),
      limit: z.number().int().optional(),
    }),
    response: z.array(CompetencyReviewSchema),
    served: 'mock',
  }),
} as const;
