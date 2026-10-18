import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  AuditEntrySchema,
  DeleteRoleResultSchema,
  RoleSchema,
  SaveRoleCommandSchema,
  UserAttemptSchema,
  UserCourseSchema,
} from './admin-org.schema';

const userParams = z.object({ userId: z.string() });
const roleParams = z.object({ roleId: z.string() });

/**
 * Admin endpoints the backend lacks (`served: 'mock'`). Keys follow the function names of
 * `lms-mockup/src/api/admin.js`; the backend's users, grants, orgs and teams are
 * `identityEndpoints` and `organizationEndpoints`.
 */
export const adminOrgEndpoints = {
  /** A user's assigned courses with server-computed progress. */
  userCourses: defineEndpoint({
    method: 'get',
    path: '/api/admin/users/{userId}/courses',
    params: userParams,
    response: z.array(UserCourseSchema),
    served: 'mock',
  }),
  /** A user's quiz attempts. */
  userAttempts: defineEndpoint({
    method: 'get',
    path: '/api/admin/users/{userId}/attempts',
    params: userParams,
    response: z.array(UserAttemptSchema),
    served: 'mock',
  }),
  /** The activity log of one user. */
  userAudit: defineEndpoint({
    method: 'get',
    path: '/api/admin/users/{userId}/audit',
    params: userParams,
    response: z.array(AuditEntrySchema),
    served: 'mock',
  }),
  /** Every mock role with the screens it grants and how many users hold it. */
  roles: defineEndpoint({
    method: 'get',
    path: '/api/admin/roles',
    response: z.array(RoleSchema),
    served: 'mock',
  }),
  /** Create a role, or update the one named by `id`. */
  saveRole: defineEndpoint({
    method: 'post',
    path: '/api/admin/roles',
    body: SaveRoleCommandSchema,
    response: RoleSchema,
    served: 'mock',
  }),
  /** Delete a custom role that no user holds. */
  deleteRole: defineEndpoint({
    method: 'delete',
    path: '/api/admin/roles/{roleId}',
    params: roleParams,
    response: DeleteRoleResultSchema,
    served: 'mock',
  }),
} as const;
