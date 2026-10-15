import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { GroupSchema, UnitSchema } from '../identity/identity.schema';
import {
  AdminMetaSchema,
  DeleteGroupResultSchema,
  OrgUnitSchema,
  SaveGroupCommandSchema,
  SaveUnitCommandSchema,
  SetUnitStatusCommandSchema,
  ResetPasswordResultSchema,
  SaveUserCommandSchema,
  SetUserStatusCommandSchema,
  UserDetailSchema,
  UserListItemSchema,
} from './admin-org.schema';

const userParams = z.object({ userId: z.string() });
const unitParams = z.object({ unitId: z.string() });
const groupParams = z.object({ groupId: z.string() });

/** Function names follow `lms-mockup/src/api/admin.js`. */
export const adminOrgEndpoints = {
  users: defineEndpoint({
    method: 'get',
    path: '/api/admin/users',
    summary: 'Users in the scope of the caller',
    response: z.array(UserListItemSchema),
    errors: [401, 403],
  }),
  user: defineEndpoint({
    method: 'get',
    path: '/api/admin/users/{userId}',
    summary: 'One user with courses, attempts, role and activity',
    params: userParams,
    response: UserDetailSchema,
    errors: [401, 403, 404],
  }),
  saveUser: defineEndpoint({
    method: 'post',
    path: '/api/admin/users',
    summary: 'Create a user, or update the one named by `id`',
    body: SaveUserCommandSchema,
    response: UserListItemSchema,
    errors: [401, 403, 422],
  }),
  setUserStatus: defineEndpoint({
    method: 'put',
    path: '/api/admin/users/{userId}/status',
    summary: 'Lock, suspend or reactivate an account',
    params: userParams,
    body: SetUserStatusCommandSchema,
    response: UserListItemSchema,
    errors: [401, 403, 404, 422],
  }),
  resetPassword: defineEndpoint({
    method: 'post',
    path: '/api/admin/users/{userId}/reset-password',
    summary: 'Send the user a password reset link',
    params: userParams,
    response: ResetPasswordResultSchema,
    errors: [401, 403, 404],
  }),
  adminMeta: defineEndpoint({
    method: 'get',
    path: '/api/admin/meta',
    summary: 'Units, groups and roles for the admin forms',
    response: AdminMetaSchema,
    errors: [401, 403],
  }),
  org: defineEndpoint({
    method: 'get',
    path: '/api/admin/org',
    summary:
      'Units in the scope of the caller with their groups, members and admins',
    response: z.array(OrgUnitSchema),
    errors: [401, 403],
  }),
  saveUnit: defineEndpoint({
    method: 'post',
    path: '/api/admin/units',
    summary: 'Create a unit, or rename the one named by `id`',
    body: SaveUnitCommandSchema,
    response: UnitSchema,
    errors: [401, 403, 422],
  }),
  setUnitStatus: defineEndpoint({
    method: 'put',
    path: '/api/admin/units/{unitId}/status',
    summary: 'Pause or reactivate a unit',
    params: unitParams,
    body: SetUnitStatusCommandSchema,
    response: UnitSchema,
    errors: [401, 403, 404],
  }),
  saveGroup: defineEndpoint({
    method: 'post',
    path: '/api/admin/groups',
    summary: 'Create a department or team, or rename the one named by `id`',
    body: SaveGroupCommandSchema,
    response: GroupSchema,
    errors: [401, 403, 422],
  }),
  deleteGroup: defineEndpoint({
    method: 'delete',
    path: '/api/admin/groups/{groupId}',
    summary: 'Delete a group that has no members',
    params: groupParams,
    response: DeleteGroupResultSchema,
    errors: [401, 403, 404, 422],
  }),
} as const;
