import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import {
  GroupSchema,
  RoleSchema,
  UnitSchema,
} from '../identity/identity.schema';
import {
  AdminMetaSchema,
  DeleteGroupResultSchema,
  DeleteRoleResultSchema,
  SaveRoleCommandSchema,
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
const roleParams = z.object({ roleId: z.string() });

/** Keys follow the function names of `lms-mockup/src/api/admin.js`. */
export const adminOrgEndpoints = {
  /** Users in the scope of the caller. */
  users: defineEndpoint({
    method: 'get',
    path: '/api/admin/users',
    response: z.array(UserListItemSchema),
  }),
  /** One user with courses, attempts, role and activity. */
  user: defineEndpoint({
    method: 'get',
    path: '/api/admin/users/{userId}',
    params: userParams,
    response: UserDetailSchema,
  }),
  /** Create a user, or update the one named by `id`. */
  saveUser: defineEndpoint({
    method: 'post',
    path: '/api/admin/users',
    body: SaveUserCommandSchema,
    response: UserListItemSchema,
  }),
  /** Lock, suspend or reactivate an account. */
  setUserStatus: defineEndpoint({
    method: 'put',
    path: '/api/admin/users/{userId}/status',
    params: userParams,
    body: SetUserStatusCommandSchema,
    response: UserListItemSchema,
  }),
  /** Send the user a password reset link. */
  resetPassword: defineEndpoint({
    method: 'post',
    path: '/api/admin/users/{userId}/reset-password',
    params: userParams,
    response: ResetPasswordResultSchema,
  }),
  /** Units, groups and roles for the admin forms. */
  adminMeta: defineEndpoint({
    method: 'get',
    path: '/api/admin/meta',
    response: AdminMetaSchema,
  }),
  /** Units in the scope of the caller with their groups, members and admins. */
  org: defineEndpoint({
    method: 'get',
    path: '/api/admin/org',
    response: z.array(OrgUnitSchema),
  }),
  /** Create a unit, or rename the one named by `id`. */
  saveUnit: defineEndpoint({
    method: 'post',
    path: '/api/admin/units',
    body: SaveUnitCommandSchema,
    response: UnitSchema,
  }),
  /** Pause or reactivate a unit. */
  setUnitStatus: defineEndpoint({
    method: 'put',
    path: '/api/admin/units/{unitId}/status',
    params: unitParams,
    body: SetUnitStatusCommandSchema,
    response: UnitSchema,
  }),
  /** Create a department or team, or rename the one named by `id`. */
  saveGroup: defineEndpoint({
    method: 'post',
    path: '/api/admin/groups',
    body: SaveGroupCommandSchema,
    response: GroupSchema,
  }),
  /** Delete a group that has no members. */
  deleteGroup: defineEndpoint({
    method: 'delete',
    path: '/api/admin/groups/{groupId}',
    params: groupParams,
    response: DeleteGroupResultSchema,
  }),
  /** Every role with the menus it grants and how many users hold it. */
  roles: defineEndpoint({
    method: 'get',
    path: '/api/admin/roles',
    response: z.array(RoleSchema),
  }),
  /** Create a role, or update the one named by `id`. */
  saveRole: defineEndpoint({
    method: 'post',
    path: '/api/admin/roles',
    body: SaveRoleCommandSchema,
    response: RoleSchema,
  }),
  /** Delete a custom role that no user holds. */
  deleteRole: defineEndpoint({
    method: 'delete',
    path: '/api/admin/roles/{roleId}',
    params: roleParams,
    response: DeleteRoleResultSchema,
  }),
} as const;
