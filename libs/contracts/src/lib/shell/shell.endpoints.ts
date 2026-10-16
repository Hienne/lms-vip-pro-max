import { defineEndpoint } from '../http/endpoint';
import { NavCountsSchema } from './shell.schema';

/** Keys follow the function names of `lms-mockup/src/api/core.js`. */
export const shellEndpoints = {
  /** Unread notifications and new inbox items for the header and sidebar badges. */
  navCounts: defineEndpoint({
    method: 'get',
    path: '/api/me/nav-counts',
    response: NavCountsSchema,
  }),
} as const;
