import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import { CourseCardSchema } from '../course/course.schema';
import {
  CourseEnrollmentSchema,
  DashboardGroupSchema,
  DashboardProgramsQuerySchema,
  EnrollmentDetailSchema,
  LeaderboardViewSchema,
  LearnerPreferencesSchema,
  UnitLeaderboardQuerySchema,
  UnitLeaderboardSchema,
  LeaderboardQuerySchema,
  LearnerCourseSchema,
  LearnerFacetsSchema,
  LearningDashboardSchema,
  LearningProgressOverviewSchema,
  LearningReminderSchema,
  MyCoursesQuerySchema,
  AdjustXpCommandSchema,
  MyBadgesSchema,
  MyLevelSchema,
  MyPointsSchema,
  XpAdjustmentResultSchema,
  MyStreakSchema,
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
   * The caller's dashboard: counts with the server's `completionRate` and `averageProgress`, where to
   * resume and the five nearest deadlines. It reads the reporting tables, so a backend that lacks
   * them answers `CORE-INTERNAL_ERROR`.
   */
  dashboard: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/dashboard',
    response: LearningDashboardSchema,
  }),
  /** The same counts per programme the caller has courses in: the programme journey (`size` at most 100). */
  dashboardPrograms: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/dashboard/programs',
    query: DashboardProgramsQuerySchema,
    response: PageSchema(DashboardGroupSchema),
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
  /**
   * Says the toast of a notice was shown: sets `sentAt` and keeps the row in the feed until it is read. Saying it
   * twice changes nothing; someone else's row is refused with `CORE-ACCESS_DENIED`.
   */
  markReminderSeen: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/learning/reminders/{reminderId}/seen',
    params: z.object({ reminderId: z.number().int() }),
    response: LearningReminderSchema,
  }),
  markReminderRead: defineEndpoint({
    method: 'post',
    path: '/api/v1/me/learning/reminders/{reminderId}/read',
    params: z.object({ reminderId: z.number().int() }),
    response: LearningReminderSchema,
  }),
  /**
   * The caller's learning points: the total, its four parts and the streak. A caller who is not a
   * learner is refused with `CORE-ACCESS_DENIED`.
   */
  myPoints: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/points',
    response: MyPointsSchema,
  }),
  /**
   * The caller's level, computed by the server (never drops). A caller who is not a learner is refused
   * with `CORE-ACCESS_DENIED`.
   */
  myLevel: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/level',
    response: MyLevelSchema,
  }),
  /**
   * A system admin's correction of a learner's XP: one extra ledger row with a mandatory reason and an
   * audit entry. Anyone who is not a system admin is refused with `CORE-ACCESS_DENIED`; a missing reason,
   * a zero amount or a correction that would make the total negative is `CORE-VALIDATION_FAILED`.
   */
  adjustXp: defineEndpoint({
    method: 'post',
    path: '/api/v1/admin/learning/xp-adjustments',
    body: AdjustXpCommandSchema,
    response: XpAdjustmentResultSchema,
  }),
  /**
   * The caller's streak in working days (weekends and bank holidays neither count nor break it) and
   * the per-day data of the 26-week heatmap. A caller who is not a learner is refused with
   * `CORE-ACCESS_DENIED`.
   */
  myStreak: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/streak',
    response: MyStreakSchema,
  }),
  /**
   * The caller's badges: earned (newest first) and not yet earned with their condition, a programme badge showing
   * the courses done out of all. The first read creates the starter set. A non-learner is refused with
   * `CORE-ACCESS_DENIED`.
   */
  myBadges: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/badges',
    response: MyBadgesSchema,
  }),
  /**
   * Learners ranked by the XP of a period (`week`, `month` by default, `all`; `offset` steps back to an earlier
   * one) in a scope (`team`, `org` by default, `all`): the top ten and the caller's own row, with the one or
   * two just above them when they are outside it. No paging. An unknown scope or period, or an `offset`
   * outside 0-520, answers `CORE-VALIDATION_FAILED`.
   */
  leaderboard: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/leaderboard',
    query: LeaderboardQuerySchema,
    response: LeaderboardViewSchema,
  }),
  /**
   * The unit (branch) ranking by average XP per active learner in a period (`week`, `month` by default, `all`;
   * `offset` steps back), with the participation rate: the top ten units with at least five learners and the
   * caller's own unit. An unknown period or an `offset` outside 0-520 answers `CORE-VALIDATION_FAILED`.
   */
  unitLeaderboard: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/leaderboard/units',
    query: UnitLeaderboardQuerySchema,
    response: UnitLeaderboardSchema,
  }),
  /** The caller's own preferences (visible on leaderboards by default). Only a learner has them. */
  myPreferences: defineEndpoint({
    method: 'get',
    path: '/api/v1/me/learning/preferences',
    response: LearnerPreferencesSchema,
  }),
  /** Shows or hides the caller's name on other learners' leaderboards; answers the preferences now in force. */
  updateMyPreferences: defineEndpoint({
    method: 'put',
    path: '/api/v1/me/learning/preferences',
    body: LearnerPreferencesSchema,
    response: LearnerPreferencesSchema,
  }),
} as const;
