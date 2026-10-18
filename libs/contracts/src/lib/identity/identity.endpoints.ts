import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  CreatedGrantSchema,
  CreateUserCommandSchema,
  GrantRequestSchema,
  ListUsersQuerySchema,
  RoleOptionSchema,
  SetUserStatusCommandSchema,
  UpdateUserCommandSchema,
  UserDetailSchema,
  UserSummarySchema,
} from './user.schema';

const userParams = z.object({ userId: z.string() });
const grantParams = z.object({ userId: z.string(), grantId: z.number().int() });

/** The backend's users, role-grants and roles endpoints (/api/v1). */
export const identityEndpoints = {
  /** Users in the scope of the caller, filtered, sorted and paged by the server. */
  listUsers: defineEndpoint({
    method: 'get',
    path: '/api/v1/users',
    query: ListUsersQuerySchema,
    response: PageSchema(UserSummarySchema),
  }),
  /** Create a LOCAL account with a temporary password and optional initial grants. */
  createUser: defineEndpoint({
    method: 'post',
    path: '/api/v1/users',
    body: CreateUserCommandSchema,
    response: UserDetailSchema,
  }),
  getUser: defineEndpoint({
    method: 'get',
    path: '/api/v1/users/{userId}',
    params: userParams,
    response: UserDetailSchema,
  }),
  /** Edit profile fields or move the user to another org or team (changed fields only). */
  updateUser: defineEndpoint({
    method: 'patch',
    path: '/api/v1/users/{userId}',
    params: userParams,
    body: UpdateUserCommandSchema,
    response: UserDetailSchema,
  }),
  /** Activate, pause (`inactive`) or lock an account. */
  setUserStatus: defineEndpoint({
    method: 'patch',
    path: '/api/v1/users/{userId}/status',
    params: userParams,
    body: SetUserStatusCommandSchema,
    response: UserDetailSchema,
  }),
  /** Grant a role with a scope to a user. */
  grantRole: defineEndpoint({
    method: 'post',
    path: '/api/v1/users/{userId}/role-grants',
    params: userParams,
    body: GrantRequestSchema,
    response: CreatedGrantSchema,
  }),
  /** Deactivate a grant; the history stays. */
  revokeRole: defineEndpoint({
    method: 'delete',
    path: '/api/v1/users/{userId}/role-grants/{grantId}',
    params: grantParams,
    response: z.unknown(),
  }),
  /** The roles the caller can see with the scopes they may grant. */
  listRoles: defineEndpoint({
    method: 'get',
    path: '/api/v1/roles',
    response: z.array(RoleOptionSchema),
  }),
} as const;
