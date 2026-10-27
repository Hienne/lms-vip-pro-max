import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { CourseDetailSchema } from '../course/course.schema';

// Mirrors the backend's learner endpoints (/api/v1/me/learning, POST /courses/{id}/enrollments).
// Progress, status and due dates are the server's results; the app renders them and reports raw
// interactions (video ranges, PDF pages) for the server to score.

/** One learning cycle of one person in one course. */
export const CourseEnrollmentSchema = z.object({
  id: z.number().int(),
  courseId: z.number().int(),
  revisionId: z.number().int(),
  userId: z.string(),
  cycleNo: z.number().int().nullish(),
  enrollmentOrigin: z.string().nullish(),
  selfEnrolledAt: BackendDateTimeSchema.nullish(),
  orgIdSnapshot: z.number().int().nullish(),
  teamIdSnapshot: z.number().int().nullish(),
  enrolledAt: BackendDateTimeSchema.nullish(),
  startedAt: BackendDateTimeSchema.nullish(),
  lastAccessAt: BackendDateTimeSchema.nullish(),
  completedAt: BackendDateTimeSchema.nullish(),
  status: z.string(),
  progressPercent: z.number().nullish(),
  /** Where to resume. */
  lastLessonId: z.number().int().nullish(),
  lastBlockId: z.number().int().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CourseEnrollment = z.infer<typeof CourseEnrollmentSchema>;

export const LessonProgressSchema = z.object({
  id: z.number().int(),
  enrollmentId: z.number().int(),
  lessonId: z.number().int(),
  status: z.string(),
  progressPercent: z.number().nullish(),
  startedAt: BackendDateTimeSchema.nullish(),
  lastAccessAt: BackendDateTimeSchema.nullish(),
  completedAt: BackendDateTimeSchema.nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LessonProgress = z.infer<typeof LessonProgressSchema>;

export const BlockProgressSchema = z.object({
  id: z.number().int(),
  enrollmentId: z.number().int(),
  blockId: z.number().int(),
  status: z.string(),
  progressPercent: z.number().nullish(),
  lastVideoPositionSeconds: z.number().nullish(),
  lastPdfPage: z.number().int().nullish(),
  startedAt: BackendDateTimeSchema.nullish(),
  lastAccessAt: BackendDateTimeSchema.nullish(),
  completedAt: BackendDateTimeSchema.nullish(),
  /** Send the next `sequence` above this one. */
  lastEventSequence: z.number().int().nullish(),
  /** Send it as `expectedVersion` with the next progress event. */
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type BlockProgress = z.infer<typeof BlockProgressSchema>;

/** The caller's enrolment with the revision they received and their progress per lesson and block. */
export const EnrollmentDetailSchema = z.object({
  enrollment: CourseEnrollmentSchema,
  content: CourseDetailSchema,
  lessons: z.array(LessonProgressSchema),
  blocks: z.array(BlockProgressSchema),
});
export type EnrollmentDetail = z.infer<typeof EnrollmentDetailSchema>;

/** The block, its lesson and the enrolment after the server applied one event. */
export const ProgressResultSchema = z.object({
  block: BlockProgressSchema,
  lesson: LessonProgressSchema,
  enrollment: CourseEnrollmentSchema,
});
export type ProgressResult = z.infer<typeof ProgressResultSchema>;

export const LearningReminderSchema = z.object({
  id: z.number().int(),
  recipientId: z.number().int(),
  scheduledAt: BackendDateTimeSchema.nullish(),
  dueAtSnapshot: BackendDateTimeSchema.nullish(),
  channel: z.string().nullish(),
  status: z.string(),
  sentAt: BackendDateTimeSchema.nullish(),
  attemptCount: z.number().int().nullish(),
  lastErrorCode: z.string().nullish(),
  idempotencyKey: z.string().nullish(),
  rowVersion: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type LearningReminder = z.infer<typeof LearningReminderSchema>;

/**
 * One interaction with a block. `expectedVersion` is the block progress's `rowVersion`; the
 * server computes the percentage and checks PDF pages and watched video ranges.
 */
export const SaveProgressCommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  sequence: z.number().int().positive().optional(),
  complete: z.boolean().optional(),
  videoPositionSeconds: z.number().nonnegative().optional(),
  watchedFromSeconds: z.number().nonnegative().optional(),
  watchedToSeconds: z.number().nonnegative().optional(),
  pdfPage: z.number().int().positive().optional(),
});
export type SaveProgressCommand = z.infer<typeof SaveProgressCommandSchema>;
