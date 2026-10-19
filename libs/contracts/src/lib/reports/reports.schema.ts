import { z } from 'zod';
import { PageSchema, PageQuerySchema } from '../http/page';
const count = z.number().int().nonnegative();
const percent = z.number().min(0).max(100);
const date = z.iso.datetime({ offset: true });
export const ReportDimensionSchema = z.enum([
  'learners',
  'courses',
  'programs',
  'groups',
  'units',
  'status',
  'results',
  'competency',
]);
export const ReportFilterSchema = z.object({
  unitId: z.string().optional(),
  groupId: z.string().optional(),
  programId: z.string().optional(),
  courseId: z.string().optional(),
  from: date.optional(),
  to: date.optional(),
});
export const ReportQuerySchema = ReportFilterSchema.extend({
  ...PageQuerySchema.shape,
  q: z.string().max(100).optional(),
});
export const ReportSummarySchema = z.object({
  enrolments: count,
  completed: count,
  inProgress: count,
  notStarted: count,
  failed: count,
  overdue: count,
  pct: percent,
  avgScore: percent.nullable(),
  passRate: percent.nullable(),
});
export const ReportGroupSchema = ReportSummarySchema.extend({
  id: z.string(),
  name: z.string(),
  learners: count,
});
export const ReportOverviewSchema = z.object({
  scope: z.object({ unitId: z.string().nullable(), label: z.string() }),
  total: ReportSummarySchema.extend({ learners: count }),
  byUnit: z.array(ReportGroupSchema),
  byGroup: z.array(ReportGroupSchema),
  byCourse: z.array(ReportGroupSchema),
  byProgram: z.array(ReportGroupSchema),
  competency: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      value: percent.nullable(),
      sampleSize: count,
    }),
  ),
  weeks: z.array(
    z.object({ weekStart: z.iso.date(), completedLessons: count }),
  ),
  filters: z.object({
    units: z.array(z.object({ id: z.string(), name: z.string() })),
    groups: z.array(
      z.object({ id: z.string(), name: z.string(), unitId: z.string() }),
    ),
    programs: z.array(z.object({ id: z.string(), name: z.string() })),
    courses: z.array(z.object({ id: z.string(), title: z.string() })),
  }),
  canEdit: z.boolean(),
});
const person = { id: z.string(), name: z.string(), unit: z.string() };
export const ReportLearnerSchema = z.object({
  ...person,
  email: z.string(),
  group: z.string(),
  status: z.string(),
  courses: count,
  completed: count,
  overdue: count,
  failed: count,
  pct: percent,
  avgScore: percent.nullable(),
  lastAccess: date.nullable(),
});
export const ReportStatusSchema = z.object({
  ...person,
  userId: z.string(),
  group: z.string(),
  courseId: z.string(),
  course: z.string(),
  status: z.enum(['not_started', 'in_progress', 'completed', 'failed']),
  overdue: z.boolean(),
  pct: percent,
  dueAt: date.nullable(),
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  lastAccess: date.nullable(),
});
export const ReportResultSchema = z.object({
  ...person,
  userId: z.string(),
  quizId: z.string(),
  quiz: z.string(),
  score: percent,
  passed: z.boolean(),
  nth: z.number().int().positive(),
  at: date,
  autoSubmitted: z.boolean(),
});
export const ReportCompetencySchema = z.object({
  ...person,
  values: z.array(
    z.object({
      competencyId: z.string(),
      name: z.string(),
      value: percent.nullable(),
    }),
  ),
});
export const ReportRowSchema = z.union([
  ReportLearnerSchema,
  ReportStatusSchema,
  ReportResultSchema,
  ReportCompetencySchema,
  ReportGroupSchema,
]);
export const ReportPageSchema = PageSchema(ReportRowSchema);
export type ReportDimension = z.infer<typeof ReportDimensionSchema>;
export type ReportFilter = z.infer<typeof ReportFilterSchema>;
export type ReportQuery = z.infer<typeof ReportQuerySchema>;
export type ReportOverview = z.infer<typeof ReportOverviewSchema>;
export type ReportRow = z.infer<typeof ReportRowSchema>;
