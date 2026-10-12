// Public API of @lms/contracts. Export every public symbol from here.
export * from './lib/http/api-error';
export * from './lib/http/endpoint';
export * from './lib/health/health.schema';
export * from './lib/health/health.endpoints';
export * from './lib/identity/identity.schema';
export * from './lib/auth/auth.schema';
export * from './lib/auth/auth.endpoints';

import { authEndpoints } from './lib/auth/auth.endpoints';
import { healthEndpoints } from './lib/health/health.endpoints';

/** Every endpoint registry; `build-spec` walks this to emit OpenAPI. */
export const endpointRegistries = [healthEndpoints, authEndpoints] as const;
