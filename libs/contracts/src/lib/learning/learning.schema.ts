import { z } from 'zod';

// Mirrors lms-mockup/src/core/types.js. Display labels (e.g. "Đang học") are UI copy and live in
// the app, not here.

/** A learner's standing in one course. */
export const CourseStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
  'failed',
]);
export type CourseStatus = z.infer<typeof CourseStatusSchema>;
