import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  LearningReportEnrollmentQuerySchema,
  LearningReportEnrollmentRowSchema,
  LearningReportExportQuerySchema,
  LearningReportFilterSchema,
  LearningReportGroupQuerySchema,
  LearningReportGroupSchema,
  LearningReportSummarySchema,
} from './learning-reports.schema';

/** Learning progress reports; the server enforces the report scope on every call. */
export const learningReportEndpoints = {
  /** The counts of the scope, with the instant and time zone they are computed for. */
  summary: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/summary',
    query: LearningReportFilterSchema,
    response: LearningReportSummarySchema,
  }),
  /** The counts per course, unit, team, program or learner (`groupBy`, default `course`). */
  groups: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/groups',
    query: LearningReportGroupQuerySchema,
    response: PageSchema(LearningReportGroupSchema),
  }),
  /** One row per enrolment, sorted on `LEARNING_REPORT_SORTS`. */
  enrollments: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/enrollments',
    query: LearningReportEnrollmentQuerySchema,
    response: PageSchema(LearningReportEnrollmentRowSchema),
  }),
  /**
   * The same rows and sort as a CSV, never just one page. Over the export limit the server refuses
   * with `LEARNING-EXPORT_TOO_LARGE` instead of cutting the file short.
   */
  exportEnrollments: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/learning/enrollments/export',
    query: LearningReportExportQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
} as const;
