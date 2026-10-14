import { defineEndpoint } from '../http/endpoint';
import { NavCountsSchema } from './shell.schema';

export const shellEndpoints = {
  navCounts: defineEndpoint({
    method: 'get',
    path: '/api/me/nav-counts',
    summary:
      'Unread notifications and new inbox items for the header and sidebar badges',
    response: NavCountsSchema,
    errors: [401],
  }),
} as const;
