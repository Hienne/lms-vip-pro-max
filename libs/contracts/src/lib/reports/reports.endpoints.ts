// Source: lms-mockup/src/api/reports.js. Proposed contracts; keep mock until BE integration is verified.
import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  ReportDimensionSchema,
  ReportFilterSchema,
  ReportQuerySchema,
  ReportOverviewSchema,
  ReportPageSchema,
} from './reports.schema';
export const reportEndpoints = {
  /** Scoped aggregates and filter options, calculated by the server. */
  overview: defineEndpoint({
    method: 'get',
    path: '/api/reports/overview',
    served: 'mock',
    query: ReportFilterSchema,
    response: ReportOverviewSchema,
  }),
  /** One of eight report dimensions, filtered and paged by the server. */
  detail: defineEndpoint({
    method: 'get',
    path: '/api/reports/{dim}',
    served: 'mock',
    params: z.object({ dim: ReportDimensionSchema }),
    query: ReportQuerySchema,
    response: ReportPageSchema,
  }),
  /** All scoped matching rows as CSV; deliberately excludes page and size. */
  export: defineEndpoint({
    method: 'get',
    path: '/api/reports/export',
    served: 'mock',
    query: ReportQuerySchema.omit({ page: true, size: true }).extend({
      dim: z.enum(['overview', ...ReportDimensionSchema.options]),
    }),
    responseType: 'blob',
    response: z.instanceof(Blob),
  }),
} as const;
