// Source: lms-mockup/src/api/learner.js. Proposed integration contract; not backend-confirmed.
import { defineEndpoint } from '../http/endpoint';
import { LearningDashboardSchema } from './learning-dashboard.schema';
export const learningDashboardEndpoints = {
  /** Current learner's server-calculated dashboard and saved continuation position. */
  dashboard: defineEndpoint({
    method: 'get',
    path: '/api/me/learning-dashboard',
    served: 'mock',
    response: LearningDashboardSchema,
  }),
} as const;
