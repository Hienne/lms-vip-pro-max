import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageSchema } from '../http/page';
import {
  AccessRequestSchema,
  AccessRequestsQuerySchema,
  ApproveAccessRequestCommandSchema,
  RegisterRequestCommandSchema,
  RegisterRequestResultSchema,
  RegistrationUnitSchema,
  RejectAccessRequestCommandSchema,
} from './access-request.schema';
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
const requestParams = z.object({ requestId: z.number().int() });
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
  /** Visitors' requests to register or to reset a password, cut to the caller's unit scope. */
  accessRequests: defineEndpoint({
    method: 'get',
    path: '/api/v1/access-requests',
    query: AccessRequestsQuerySchema,
    response: PageSchema(AccessRequestSchema),
  }),
  /** Refuse a pending request, with an optional note; a resolved request answers 409. */
  rejectAccessRequest: defineEndpoint({
    method: 'post',
    path: '/api/v1/access-requests/{requestId}/reject',
    params: requestParams,
    body: RejectAccessRequestCommandSchema,
    response: AccessRequestSchema,
  }),
  /** Approve a pending registration: creates the account and answers the resolved request. */
  approveAccessRequest: defineEndpoint({
    method: 'post',
    path: '/api/v1/access-requests/{requestId}/approve',
    params: requestParams,
    body: ApproveAccessRequestCommandSchema,
    response: AccessRequestSchema,
  }),
  /** Public: the units a visitor can choose on the registration form (id and name only). */
  registrationUnits: defineEndpoint({
    method: 'get',
    path: '/api/v1/auth/registration-units',
    response: z.array(RegistrationUnitSchema),
  }),
  /** Public: send a registration request; the answer is the same for any staff code. */
  registerRequest: defineEndpoint({
    method: 'post',
    path: '/api/v1/auth/register-request',
    body: RegisterRequestCommandSchema,
    response: RegisterRequestResultSchema,
  }),
} as const;
