import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageSchema } from '../http/page';
import {
  CourseCardSchema,
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

/** Conditions evaluated by the server for this enrollment and its frozen revision. */
export const CompletionSummarySchema = z.object({
  completedRequiredLessons: z.number().int().nonnegative(),
  requiredLessons: z.number().int().nonnegative(),
  lessonsSatisfied: z.boolean(),
  finalQuizId: z.number().int().nullable(),
  finalExamStatus: z.enum([
    'NOT_REQUIRED',
    'NOT_TAKEN',
    'NOT_PASSED',
    'PASSED',
  ]),
  allSatisfied: z.boolean(),
});
export type CompletionSummary = z.infer<typeof CompletionSummarySchema>;

/** The caller's enrolment with the revision they received and their progress per lesson and block. */
export const EnrollmentDetailSchema = z.object({
  enrollment: CourseEnrollmentSchema,
  content: CourseDetailSchema,
  lessons: z.array(LessonProgressSchema),
  blocks: z.array(BlockProgressSchema),
  /** Optional during rollout; an absent evaluation must never be inferred as passed. */
  completion: CompletionSummarySchema.optional(),
});
export type EnrollmentDetail = z.infer<typeof EnrollmentDetailSchema>;

/** The block, its lesson and the enrolment after the server applied one event. */

/** The backend lists only `pending` reminders that are due; reading one sets it to `sent`. */
export const ReminderStatusSchema = z.enum(['pending', 'sent', 'cancelled']);
export type ReminderStatus = z.infer<typeof ReminderStatusSchema>;

export const LearningReminderSchema = z.object({
  id: z.number().int(),
  recipientId: z.number().int(),
  scheduledAt: BackendDateTimeSchema.nullish(),
  dueAtSnapshot: BackendDateTimeSchema.nullish(),
  channel: z.string().nullish(),
  status: ReminderStatusSchema,
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

/** The caller's latest graded attempt over every quiz of their current courses. */
export const LastScoreSchema = z.object({
  quizId: z.number().int(),
  quizTitle: z.string(),
  courseId: z.number().int(),
  attemptId: z.number().int(),
  scorePercent: z.number().nullable(),
  /** The attempt's own result, not the quiz's score method. */
  passed: z.boolean().nullable(),
  submittedAt: BackendDateTimeSchema,
});
export type LastScore = z.infer<typeof LastScoreSchema>;

/**
 * `AssessmentOverview`: the scores over the published quizzes of the caller's current courses,
 * computed by the server by the same rule as a quiz's own summary. The figures are null while the
 * caller has no graded attempt; `quizCount` includes practice quizzes.
 */
export const AssessmentOverviewSchema = z.object({
  availability: z.literal('available'),
  last: LastScoreSchema.nullable(),
  bestScorePercent: z.number().nullable(),
  /** The mean of each quiz's final score, one number per quiz. */
  averageScorePercent: z.number().nullable(),
  passedQuizCount: z.number().int(),
  quizCount: z.number().int(),
});
export type AssessmentOverview = z.infer<typeof AssessmentOverviewSchema>;

/**
 * Anything but `available` is a metric the server cannot give. `available` is refused here so a
 * malformed overview is a contract error instead of being read as an unavailable one.
 */
export const UnavailableSchema = AvailabilitySchema.refine(
  (value) => value.availability !== 'available',
  { error: 'An available metric needs its figures' },
);

/**
 * `LearningProgressOverview`: counts over the caller's current cycles, independent of any table
 * filter. `activity` and `competency` are `unavailable` until the backend has the data (no hours or
 * streaks are invented in the meantime). `assessment` is an `AssessmentOverview` when the caller's
 * courses have a published quiz, else `unavailable`.
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
    /** The totals of `myCourses` with `assigned=true` and with `requirement=mandatory`. */
    assigned: z.number().int(),
    mandatory: z.number().int(),
  }),
  activity: AvailabilitySchema,
  assessment: z.union([AssessmentOverviewSchema, UnavailableSchema]),
  competency: AvailabilitySchema,
});
export type LearningProgressOverview = z.infer<
  typeof LearningProgressOverviewSchema
>;

/** A course the caller can see: its card and its content (the enrolled revision, else the published one). */
export const LearnerCourseSchema = z.object({
  card: CourseCardSchema,
  content: CourseDetailSchema,
});
export type LearnerCourse = z.infer<typeof LearnerCourseSchema>;

/** A field of the catalogue the caller sees. */
export const LearnerFacetSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
});
export type LearnerFacet = z.infer<typeof LearnerFacetSchema>;

/** A programme or a module, with the field it belongs to. */
export const LearnerFieldFacetSchema = LearnerFacetSchema.extend({
  fieldId: z.number().int(),
});
export type LearnerFieldFacet = z.infer<typeof LearnerFieldFacetSchema>;

/** The names the catalogue's selects list: only values a visible course uses, in the server's order. */
export const LearnerFacetsSchema = z.object({
  fields: z.array(LearnerFacetSchema),
  programs: z.array(LearnerFieldFacetSchema),
  modules: z.array(LearnerFieldFacetSchema),
});
export type LearnerFacets = z.infer<typeof LearnerFacetsSchema>;

export const LearningStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'completed',
]);
export type LearningStatus = z.infer<typeof LearningStatusSchema>;

/**
 * The filters of the learner's lists ("my courses" and the catalogue): the shared list filters, a
 * typed status and the `overdue`, `assigned` and `failed` flags the server evaluates.
 */
export const MyCoursesQuerySchema = CourseListQuerySchema.extend({
  learningStatus: LearningStatusSchema.optional(),
  overdue: z.boolean().optional(),
  assigned: z.boolean().optional(),
  failed: z.boolean().optional(),
});
export type MyCoursesQuery = z.infer<typeof MyCoursesQuerySchema>;

/** The same filters and sort as the table, no paging; at most 10,000 rows. */
export const ProgressExportQuerySchema = MyCoursesQuerySchema.omit({
  page: true,
  size: true,
});
export type ProgressExportQuery = z.infer<typeof ProgressExportQuerySchema>;

// ---- Points and leaderboard ---------------------------------------------------------------

/** Who the leaderboard ranks: the caller's team, their org, or every learner in the system. */
export const LeaderboardScopeSchema = z.enum(['team', 'org', 'all']);
export type LeaderboardScope = z.infer<typeof LeaderboardScopeSchema>;

/** `scope` defaults to `org` on the server; `size` is at most 100. */
export const LeaderboardQuerySchema = z.object({
  scope: LeaderboardScopeSchema.optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(100).optional(),
});
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

/**
 * One learner on the board. The server ranks by total points, ties share a rank (1, 1, 3) and a
 * learner with no points comes after everyone else. `teamName` is null for a learner with no team.
 */
export const LeaderboardRowSchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string(),
  fullName: z.string(),
  teamName: z.string().nullish(),
  points: z.number().int().nonnegative(),
  /** Consecutive learning days, as the server counts them. */
  streakDays: z.number().int().nonnegative(),
  /** True on the caller's own row. */
  me: z.boolean(),
});
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;

/**
 * The caller's row for the scope asked. `rank` is null when the caller is not in that scope, such as
 * a learner with no team reading `team`.
 */
export const LeaderboardMeSchema = LeaderboardRowSchema.extend({
  rank: z.number().int().positive().nullish(),
});
export type LeaderboardMe = z.infer<typeof LeaderboardMeSchema>;

/** `LeaderboardPage`: a page of rows and the caller's own row, whether or not it is on the page. */
export const LeaderboardPageSchema = z.object({
  page: PageSchema(LeaderboardRowSchema),
  me: LeaderboardMeSchema,
});
export type LeaderboardPage = z.infer<typeof LeaderboardPageSchema>;

/** The XP of each source, read from the ledger; `total` is their sum. A streak earns no XP. */
export const PointPartsSchema = z.object({
  /** Lessons completed, each counted once however many cycles or revisions. */
  lessons: z.number().int().nonnegative(),
  /** Distinct quizzes passed. */
  quizzes: z.number().int().nonnegative(),
  /** The bonus of each quiz passed on the first try with a high score. */
  firstTryBonus: z.number().int().nonnegative(),
  /** The reward of each course completed. */
  courses: z.number().int().nonnegative(),
  /** The XP of community answers accepted or marked helpful, capped per day by the server. */
  community: z.number().int().nonnegative(),
});
export type PointParts = z.infer<typeof PointPartsSchema>;

/** `MyPoints`: the caller's XP total, its parts and the current working-day streak (display only). It has no rank. */
export const MyPointsSchema = z.object({
  total: z.number().int().nonnegative(),
  parts: PointPartsSchema,
  streakDays: z.number().int().nonnegative(),
});
export type MyPoints = z.infer<typeof MyPointsSchema>;

/**
 * `LearningStreakViews.HeatmapDay`: one calendar day (Asia/Ho_Chi_Minh) of the activity heatmap. `lessons`
 * and `quizzes` are the lessons completed and the quizzes submitted that day; `restDay` is a weekend or a
 * bank holiday (a make-up Saturday is a working day). Learning on a rest day shows here and adds nothing
 * to the streak.
 */
export const HeatmapDaySchema = z.object({
  date: z.iso.date(),
  lessons: z.number().int().nonnegative(),
  quizzes: z.number().int().nonnegative(),
  restDay: z.boolean(),
});
export type HeatmapDay = z.infer<typeof HeatmapDaySchema>;

/**
 * `LearningStreakViews.MyStreak`: the caller's streak in working days and the heatmap data. `days` covers
 * the last 26 weeks up to today, starts on a Monday and holds one row per day, days without activity
 * included. The server decides what qualifies a day and which days are rest days; the app only shades.
 */
export const MyStreakSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  days: z.array(HeatmapDaySchema),
});
export type MyStreak = z.infer<typeof MyStreakSchema>;

/**
 * `LearningAnalytics.Counts`: the server's counts over a set of enrolments. Both percents are the
 * server's: `completionRate` is completed / total and `averageProgress` the mean of the courses'
 * progress, each to two decimals.
 */
export const DashboardCountsSchema = z.object({
  enrollments: z.number().int(),
  learners: z.number().int(),
  courses: z.number().int(),
  assigned: z.number().int(),
  mandatory: z.number().int(),
  completed: z.number().int(),
  inProgress: z.number().int(),
  notStarted: z.number().int(),
  overdue: z.number().int(),
  averageProgress: z.number(),
  completionRate: z.number(),
});
export type DashboardCounts = z.infer<typeof DashboardCountsSchema>;

/** Where the caller left off, to resume. */
export const DashboardNextActionSchema = z.object({
  enrollmentId: z.number().int(),
  courseId: z.number().int(),
  courseTitle: z.string(),
  lessonId: z.number().int().nullable(),
  blockId: z.number().int().nullable(),
  blockType: z.string().nullable(),
  quizId: z.number().int().nullable(),
  assetId: z.number().int().nullable(),
  lastPdfPage: z.number().int().nullable(),
  lastVideoPositionSeconds: z.number().nullable(),
});
export type DashboardNextAction = z.infer<typeof DashboardNextActionSchema>;

/** One enrolment of the dashboard's deadline list. */
export const DashboardEnrollmentSchema = z.object({
  id: z.number().int(),
  userId: z.string(),
  courseId: z.number().int(),
  courseCode: z.string(),
  courseTitle: z.string(),
  revisionId: z.number().int(),
  programId: z.number().int().nullable(),
  programName: z.string().nullable(),
  orgId: z.number().int().nullable(),
  teamId: z.number().int().nullable(),
  status: LearningStatusSchema,
  progressPercent: z.number(),
  assigned: z.boolean(),
  mandatory: z.boolean(),
  enrolledAt: BackendDateTimeSchema.nullable(),
  startedAt: BackendDateTimeSchema.nullable(),
  lastAccessAt: BackendDateTimeSchema.nullable(),
  completedAt: BackendDateTimeSchema.nullable(),
  dueAt: BackendDateTimeSchema.nullable(),
  overdue: z.boolean(),
  canStudy: z.boolean(),
});
export type DashboardEnrollment = z.infer<typeof DashboardEnrollmentSchema>;

/** The caller's learning figures: counts, where to resume and the nearest deadlines (at most five). */
export const DashboardLearningSchema = z.object({
  counts: DashboardCountsSchema,
  nextAction: DashboardNextActionSchema.nullable(),
  deadlines: z.array(DashboardEnrollmentSchema),
});
export type DashboardLearning = z.infer<typeof DashboardLearningSchema>;

/** A graded attempt named by the dashboard's assessment block. */
export const DashboardAttemptSchema = z.object({
  quizId: z.number().int(),
  quizTitle: z.string(),
  courseId: z.number().int(),
  attemptId: z.number().int(),
  enrollmentId: z.number().int().nullable(),
  scorePercent: z.number().nullable(),
  passed: z.boolean().nullable(),
  submittedAt: BackendDateTimeSchema,
});

/** `LearningAnalytics.Home`: the dashboard over the caller's current cycles. */
export const LearningDashboardSchema = z.object({
  dataAsOf: BackendDateTimeSchema,
  timeZone: z.string(),
  learning: DashboardLearningSchema,
  assessment: z
    .object({
      counts: z.object({
        assessedQuizCount: z.number().int(),
        passedQuizCount: z.number().int(),
      }),
      latest: DashboardAttemptSchema.nullable(),
      best: DashboardAttemptSchema.nullable(),
    })
    .nullish(),
});
export type LearningDashboard = z.infer<typeof LearningDashboardSchema>;

/** Paging of the programme list; the backend accepts a `size` of 100 at most. */
export const DashboardProgramsQuerySchema = z.object({
  page: z.number().int().min(0).optional(),
  size: z.number().int().min(1).max(100).optional(),
});
export type DashboardProgramsQuery = z.infer<
  typeof DashboardProgramsQuerySchema
>;

/**
 * `LearningAnalytics.Group`: the counts of one programme over the caller's courses in it. The id is
 * a string on the wire.
 */
export const DashboardGroupSchema = DashboardCountsSchema.omit({
  assigned: true,
  mandatory: true,
}).extend({
  id: z.string(),
  name: z.string(),
});
export type DashboardGroup = z.infer<typeof DashboardGroupSchema>;
