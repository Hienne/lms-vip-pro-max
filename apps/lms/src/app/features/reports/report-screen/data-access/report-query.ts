import type { ParamMap, Params } from '@angular/router';
import {
  AssessmentReportExportQuerySchema,
  LearningStatusSchema,
  type AssessmentReportType,
  type LearningStatus,
} from '@lms/contracts';
import { z } from 'zod';

/** How "Tiến độ & hoàn thành" groups the enrolments. */
export const PROGRESS_VIEWS = [
  'course',
  'org',
  'program',
  'team',
  'learners',
] as const;
export type ProgressView = (typeof PROGRESS_VIEWS)[number];

/** The filters a report screen applies, as the URL carries them. */
export type ReportFilters = z.infer<
  typeof AssessmentReportExportQuerySchema
> & {
  programId?: number;
  /** The learning status of "Tiến độ & hoàn thành". */
  learningStatus?: LearningStatus;
  /** Only the overdue enrolments. */
  overdue?: boolean;
  view?: ProgressView;
};
export type ReportFilterKey = keyof ReportFilters;
/** A report tab: the overview, the learning progress or one of the exam reports. */
export type ReportTab = 'overview' | 'progress' | AssessmentReportType;

const id = z.coerce.number().int().positive().optional().catch(undefined);
const dateTime = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)))
  .optional()
  .catch(undefined);
const shape = AssessmentReportExportQuerySchema.shape;

/** Each key read from the query string; a value the key cannot hold is dropped. */
const QuerySchema = z.object({
  orgId: id,
  teamId: id,
  courseId: id,
  programId: id,
  quizId: id,
  from: dateTime,
  to: dateTime,
  userId: z.string().min(1).max(20).optional().catch(undefined),
  status: shape.status.catch(undefined),
  passed: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional()
    .catch(undefined),
  learnerStatus: shape.learnerStatus.catch(undefined),
  groupBy: shape.groupBy.catch(undefined),
  learningStatus: LearningStatusSchema.optional().catch(undefined),
  overdue: z
    .literal('true')
    .transform(() => true)
    .optional()
    .catch(undefined),
  view: z.enum(PROGRESS_VIEWS).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
});

const KEYS = [
  'programId',
  'orgId',
  'teamId',
  'courseId',
  'quizId',
  'from',
  'to',
  'userId',
  'status',
  'passed',
  'learnerStatus',
  'groupBy',
  'learningStatus',
  'overdue',
  'view',
] as const satisfies readonly ReportFilterKey[];

const COMMON = [
  'orgId',
  'teamId',
  'courseId',
  'quizId',
  'from',
  'to',
] as const satisfies readonly ReportFilterKey[];

/** The filters each tab reads. "Tình trạng học viên" keeps the course its quiz was picked from. */
export const TAB_FILTERS: Record<ReportTab, readonly ReportFilterKey[]> = {
  overview: COMMON,
  progress: [
    'programId',
    'orgId',
    'teamId',
    'courseId',
    'learningStatus',
    'overdue',
    'from',
    'to',
    'view',
  ],
  results: [...COMMON, 'userId', 'status', 'passed'],
  learners: ['orgId', 'teamId', 'courseId', 'quizId', 'learnerStatus'],
  competency: [...COMMON, 'groupBy'],
  questions: COMMON,
};

/** The filters and the page a URL names. */
export function filtersFromQuery(params: ParamMap): {
  filters: ReportFilters;
  page: number;
} {
  const raw = Object.fromEntries(
    [...KEYS, 'page'].flatMap((key) => {
      const value = params.get(key);
      return value === null ? [] : [[key, value]];
    }),
  );
  const { page, ...parsed } = QuerySchema.parse(raw);
  const filters = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined),
  ) as ReportFilters;
  return { filters, page };
}

/** The query string for the filters and the page; empty values and page 1 are left out. */
export function queryFromFilters(
  filters: ReportFilters,
  page = 1,
  keys: readonly ReportFilterKey[] = KEYS,
): Params {
  const params: Params = Object.fromEntries(
    keys.flatMap((key) => {
      const value = filters[key];
      return value === undefined || value === '' ? [] : [[key, String(value)]];
    }),
  );
  if (page > 1) params['page'] = String(page);
  return params;
}

/** The query a tab link carries: the current filters that tab reads, from its first page. */
export function tabQuery(tab: ReportTab, filters: ReportFilters): Params {
  return queryFromFilters(filters, 1, TAB_FILTERS[tab]);
}
