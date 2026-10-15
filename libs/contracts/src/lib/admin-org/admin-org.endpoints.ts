import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  AdminMetaSchema,
  ResetPasswordResultSchema,
  SaveUserCommandSchema,
  SetUserStatusCommandSchema,
  UserDetailSchema,
  UserListItemSchema,
} from './admin-org.schema';

const userParams = z.object({ userId: z.string() });

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
} as const;
