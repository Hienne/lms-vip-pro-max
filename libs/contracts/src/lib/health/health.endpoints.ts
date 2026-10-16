import { defineEndpoint } from '../http/endpoint';
import { HealthSchema } from './health.schema';

/** Infrastructure endpoint: backend liveness. */
export const healthEndpoints = {
  /** Backend liveness. */
  health: defineEndpoint({
    method: 'get',
    path: '/api/health',
    response: HealthSchema,
  }),
} as const;
