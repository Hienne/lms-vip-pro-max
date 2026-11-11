import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AssessmentReportTypeSchema,
  AssessmentReportFilterSchema,
  AssessmentReportOverviewSchema,
  AssessmentReportResultQuerySchema,
  AssessmentReportResultRowSchema,
  AssessmentReportLearnerQuerySchema,
  AssessmentReportLearnerRowSchema,
  AssessmentReportCompetencyQuerySchema,
  AssessmentReportCompetencyRowSchema,
  AssessmentReportQuestionQuerySchema,
  AssessmentReportQuestionRowSchema,
  AssessmentReportExportQuerySchema,
} from './assessment-reports.schema';

/** The Java assessment reports enforce role/scope and historical org/team snapshots on every call. */
export const assessmentReportEndpoints = {
  overview: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/overview',
    query: AssessmentReportFilterSchema,
    response: AssessmentReportOverviewSchema,
  }),
  quizOptions: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/quiz-options',
    query: AssessmentReportFilterSchema.pick({
      orgId: true,
      teamId: true,
      courseId: true,
      quizId: true,
    }),
    response: z.array(
      z.object({ id: z.number().int().positive(), name: z.string() }),
    ),
  }),
  results: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/results',
    query: AssessmentReportResultQuerySchema,
    response: PageSchema(AssessmentReportResultRowSchema),
  }),
  /** quizId is mandatory; from/to do not apply to this report. */
  learners: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/learners',
    query: AssessmentReportLearnerQuerySchema,
    response: PageSchema(AssessmentReportLearnerRowSchema),
  }),
  competency: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/competency',
    query: AssessmentReportCompetencyQuerySchema,
    response: PageSchema(AssessmentReportCompetencyRowSchema),
  }),
  questions: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/questions',
    query: AssessmentReportQuestionQuerySchema,
    response: PageSchema(AssessmentReportQuestionRowSchema),
  }),
  /** Same filters and sort as its corresponding table; never export just the visible page. */
  export: defineEndpoint({
    method: 'get',
    path: '/api/v1/reports/assessment/{type}/export',
    params: z.object({ type: AssessmentReportTypeSchema }),
    query: AssessmentReportExportQuerySchema,
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
} as const;
