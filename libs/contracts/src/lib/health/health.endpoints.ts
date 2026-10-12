import { defineEndpoint } from '../http/endpoint';
import { HealthSchema } from './health.schema';

/** Infrastructure endpoint: keeps the spec non-empty and checks the dev proxy. */
export const healthEndpoints = {
  health: defineEndpoint({
    method: 'get',
    path: '/api/health',
    summary: 'Mock server liveness',
    response: HealthSchema,
    errors: [],
  }),
} as const;
