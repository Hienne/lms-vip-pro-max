import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import {
  CourseDetailSchema,
  CourseListQuerySchema,
} from '../course/course.schema';

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
  /** The asset the position or page was measured on; a different asset resets it. */
  mediaAssetId: z.number().int().nullish(),
  /** Seconds of the video covered by the watched ranges. */
  watchedSeconds: z.number().nullish(),
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

export const ProgressEventTypeSchema = z.enum([
  'OPEN',
  'PLAY',
  'HEARTBEAT',
  'PAUSE',
  'SEEK',
  'PDF_PAGE',
  'COMPLETE',
  'CLOSE',
]);
export type ProgressEventType = z.infer<typeof ProgressEventTypeSchema>;

/** Claims the account's one study session on a block (`MediaRequests.Session`). */
export const OpenSessionCommandSchema = z.object({
  enrollmentId: z.number().int().positive(),
  blockId: z.number().int().positive(),
  /** The session this tab holds, so changing block in the same player is not a takeover. */
  previousSessionId: z.uuid().optional(),
  previousFence: z.number().int().positive().optional(),
  /** True only after the learner confirmed moving the session to this device. */
  takeover: z.boolean(),
});
export type OpenSessionCommand = z.infer<typeof OpenSessionCommandSchema>;

/** `MediaViews.Session`: the lease to echo on every event, and where the block resumes. */
export const StudySessionSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int(),
  leaseExpiresAt: BackendDateTimeSchema,
  lastAcceptedSequence: z.number().int(),
  enrollmentId: z.number().int(),
  blockId: z.number().int(),
  assetId: z.number().int().nullish(),
  /** Send it as `expectedVersion` with the first event. */
  expectedVersion: z.number().int(),
  resume: BlockProgressSchema.nullish(),
});
export type StudySession = z.infer<typeof StudySessionSchema>;

/** `MediaViews.Receipt`, returned with every progress result. */
export const SessionReceiptSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int(),
  lastAcceptedSequence: z.number().int(),
  /** `active`, or `released` after a `CLOSE`. */
  leaseState: z.string(),
  /** The server's absolute expiry; a repeated ACK does not extend it. */
  leaseExpiresAt: BackendDateTimeSchema.nullish(),
});
export type SessionReceipt = z.infer<typeof SessionReceiptSchema>;

/** The block, its lesson and the enrolment after the server applied one event. */
export const ProgressResultSchema = z.object({
  block: BlockProgressSchema,
  lesson: LessonProgressSchema,
  enrollment: CourseEnrollmentSchema,
  session: SessionReceiptSchema,
});
export type ProgressResult = z.infer<typeof ProgressResultSchema>;

/**
 * One interaction with a block (`LearningRequests.ProgressRequest`). The server scores it and
 * checks PDF pages and watched video ranges; the app never sends a percentage.
 */
export const SaveProgressCommandSchema = z.object({
  sessionId: z.uuid(),
  sessionFence: z.number().int().positive(),
  eventType: ProgressEventTypeSchema,
  assetId: z.number().int().positive().nullable(),
  /** True only while a video is actually playing. */
  playing: z.boolean(),
  /** The block progress's `rowVersion`. */
  expectedVersion: z.number().int().nonnegative(),
  /** The receipt's `lastAcceptedSequence` + 1; 1 in a new session. */
  sequence: z.number().int().positive(),
  complete: z.boolean(),
  videoPositionSeconds: z.number().nonnegative().optional(),
  watchedFromSeconds: z.number().nonnegative().optional(),
  watchedToSeconds: z.number().nonnegative().optional(),
  pdfPage: z.number().int().positive().optional(),
});
export type SaveProgressCommand = z.infer<typeof SaveProgressCommandSchema>;

// ---- Progress overview and export ---------------------------------------------------------

/** What the backend can say about a metric: anything but data it has is `unavailable`. */
export const AvailabilitySchema = z.object({ availability: z.string() });

/**
 * `LearningProgressOverview`: counts over the caller's current cycles, independent of any table
 * filter. `activity`, `assessment` and `competency` are `unavailable` until the backend has the
 * data (no hours, scores or streaks are invented in the meantime).
 */
export const LearningProgressOverviewSchema = z.object({
  serverTime: BackendDateTimeSchema,
  timeZone: z.string(),
  counts: z.object({
    total: z.number().int(),
    completed: z.number().int(),
    inProgress: z.number().int(),
    notStarted: z.number().int(),
    overdue: z.number().int(),
  }),
  activity: AvailabilitySchema,
  assessment: AvailabilitySchema,
  competency: AvailabilitySchema,
});
export type LearningProgressOverview = z.infer<
  typeof LearningProgressOverviewSchema
>;

export const LearningStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
]);
export type LearningStatus = z.infer<typeof LearningStatusSchema>;

/** The filters of "my courses": the shared list filters, a typed status and the overdue flag. */
export const MyCoursesQuerySchema = CourseListQuerySchema.extend({
  learningStatus: LearningStatusSchema.optional(),
  overdue: z.boolean().optional(),
});
export type MyCoursesQuery = z.infer<typeof MyCoursesQuerySchema>;

/** The same filters and sort as the table, no paging; at most 10,000 rows. */
export const ProgressExportQuerySchema = MyCoursesQuerySchema.omit({
  page: true,
  size: true,
});
export type ProgressExportQuery = z.infer<typeof ProgressExportQuerySchema>;
