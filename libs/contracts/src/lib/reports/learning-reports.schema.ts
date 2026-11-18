import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';
import {
  DashboardCountsSchema,
  DashboardEnrollmentSchema,
  LearningStatusSchema,
} from '../learner/learner.schema';

/**
 * LearningReportController (`/api/v1/reports/learning`): the current cycle of each enrolment in the
 * caller's report scope. Org and team are the ones recorded at enrolment. The server computes every
 * figure; the app shows them as they come.
 */
export const LearningReportFilterSchema = z.object({
  q: z.string().max(100).optional(),
  userId: z.string().max(20).optional(),
  orgId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  courseId: z.number().int().positive().optional(),
  programId: z.number().int().positive().optional(),
  fieldId: z.number().int().positive().optional(),
  status: LearningStatusSchema.optional(),
  overdue: z.boolean().optional(),
  /** Enrolled at or after this instant. */
  from: BackendDateTimeSchema.optional(),
  /** Enrolled before this instant (exclusive). */
  to: BackendDateTimeSchema.optional(),
});
export type LearningReportFilter = z.infer<typeof LearningReportFilterSchema>;

/** The `LearningAnalytics.Counts` of a scope or a group. */
export const LearningReportCountsSchema = DashboardCountsSchema;
export type LearningReportCounts = z.infer<typeof LearningReportCountsSchema>;

export const LearningReportSummarySchema = z.object({
  dataAsOf: BackendDateTimeSchema,
  timeZone: z.string(),
  counts: LearningReportCountsSchema,
});
export type LearningReportSummary = z.infer<typeof LearningReportSummarySchema>;

/** Zero selects all enrollments. Daily activity is capped at 30 days in that mode. */
export const MANAGEMENT_DASHBOARD_PERIODS = [0, 7, 14, 30] as const;
export type ManagementDashboardPeriod =
  (typeof MANAGEMENT_DASHBOARD_PERIODS)[number];

export const ManagementDashboardQuerySchema = z.object({
  days: z.literal(MANAGEMENT_DASHBOARD_PERIODS).optional(),
});

export const ManagementDashboardSchema = LearningReportSummarySchema.extend({
  daily: z.array(
    z.object({
      date: z.iso.date(),
      started: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
    }),
  ),
});

export const LearningReportGroupBySchema = z.enum([
  'course',
  'org',
  'team',
  'program',
  'user',
]);
export type LearningReportGroupBy = z.infer<typeof LearningReportGroupBySchema>;

/** One group: its id (a string, a staff code when grouped by user), its name and its counts. */
export const LearningReportGroupSchema = LearningReportCountsSchema.omit({
  assigned: true,
  mandatory: true,
}).extend({
  id: z.string().nullable(),
  name: z.string().nullable(),
});
export type LearningReportGroup = z.infer<typeof LearningReportGroupSchema>;

export const LearningReportGroupQuerySchema = LearningReportFilterSchema.extend(
  {
    groupBy: LearningReportGroupBySchema.optional(),
  },
).merge(PageQuerySchema.omit({ sort: true }));
export type LearningReportGroupQuery = z.infer<
  typeof LearningReportGroupQuerySchema
>;

/** The sort keys the enrolment list accepts (`key,asc|desc`). */
export const LEARNING_REPORT_SORTS = [
  'id',
  'progressPercent',
  'dueAt',
  'lastAccessAt',
  'enrolledAt',
] as const;

export const LearningReportEnrollmentQuerySchema =
  LearningReportFilterSchema.merge(PageQuerySchema);
export type LearningReportEnrollmentQuery = z.infer<
  typeof LearningReportEnrollmentQuerySchema
>;

export const LearningReportExportQuerySchema =
  LearningReportFilterSchema.extend({ sort: z.string().optional() });
export type LearningReportExportQuery = z.infer<
  typeof LearningReportExportQuerySchema
>;

export const LearningReportEnrollmentSchema = DashboardEnrollmentSchema;
export type LearningReportEnrollment = z.infer<
  typeof LearningReportEnrollmentSchema
>;

/** A row of the learner list: the enrolment and the names the report resolves. */
export const LearningReportEnrollmentRowSchema = z.object({
  enrollment: LearningReportEnrollmentSchema,
  fullName: z.string().nullable(),
  orgName: z.string().nullable(),
  teamName: z.string().nullable(),
});
export type LearningReportEnrollmentRow = z.infer<
  typeof LearningReportEnrollmentRowSchema
>;
