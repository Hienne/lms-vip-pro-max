import { z } from 'zod';
import { PageQuerySchema } from '../http/page';
import { UserInfoSchema } from '../auth/auth-v1.schema';
import {
  AccountStatusSchema,
  FunctionInfoSchema,
  GrantScopeSchema,
  ScopeTypeSchema,
} from './identity.schema';

// Mirrors the backend's users, role-grants and roles endpoints (/api/v1/users, /api/v1/roles).
// Who may call them, and which rows they return, is the server's rule: it cuts every list to the
// scope of the caller and reports `editable` / `revocable` per row.

/** A row of the users list. */
export const UserSummarySchema = z.object({
  /** The staff code; keep it a string, it has leading zeros. */
  userId: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  status: AccountStatusSchema,
  authProvider: z.enum(['LOCAL', 'SSO']),
  mustChangePassword: z.boolean(),
  orgId: z.number().int().nullish(),
  orgName: z.string().nullish(),
  orgType: z.string().nullish(),
  teamId: z.number().int().nullish(),
  teamName: z.string().nullish(),
  positionName: z.string().nullish(),
  roleCodes: z.array(z.string()),
  /** False when the caller may read the row but not change it. */
  editable: z.boolean(),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;

/** One grant of a user: a role together with the scope it applies to. */
export const ManagedRoleGrantSchema = z.object({
  grantId: z.number().int(),
  roleId: z.number().int(),
  roleCode: z.string(),
  roleName: z.string(),
  scope: GrantScopeSchema,
  orgName: z.string().nullish(),
  teamName: z.string().nullish(),
  grantedBy: z.string().nullish(),
  grantedAt: z.iso.datetime({ offset: true, local: true }).nullish(),
  /** False when the caller may not revoke it (an administrator grant, their own grant). */
  revocable: z.boolean(),
});
export type ManagedRoleGrant = z.infer<typeof ManagedRoleGrantSchema>;

export const UserDetailSchema = z.object({
  user: UserInfoSchema,
  roleGrants: z.array(ManagedRoleGrantSchema),
  editable: z.boolean(),
});
export type UserDetail = z.infer<typeof UserDetailSchema>;

/** A role the caller can see, with the scopes they may grant it (empty: they may not). */
export const RoleOptionSchema = z.object({
  roleId: z.number().int(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  assignableScopes: z.array(ScopeTypeSchema),
  /** Administrative actions the role can have; they still depend on scope and target. */
  capabilities: z.array(z.string()),
  functions: z.array(FunctionInfoSchema),
});
export type RoleOption = z.infer<typeof RoleOptionSchema>;

/** The sort fields the backend accepts for the users list. */
export const USER_SORT_FIELDS = [
  'id',
  'username',
  'fullName',
  'createTime',
] as const;

export const ListUsersQuerySchema = PageQuerySchema.extend({
  /** Matches staff code, username, full name and email; at most 100 characters, literal text. */
  q: z.string().optional(),
  roleCode: z.string().optional(),
  orgId: z.number().int().optional(),
  teamId: z.number().int().optional(),
  status: AccountStatusSchema.optional(),
});
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;

/** Field rules of `CreateUserRequest`; the form and the schema share them. */
export const USER_LIMITS = {
  userIdPattern: /^[A-Za-z0-9._-]{1,20}$/,
  usernamePattern: /^[A-Za-z0-9._-]{1,100}$/,
  fullName: 255,
  email: 100,
  positionName: 255,
  maxInitialGrants: 20,
} as const;

/**
 * A grant to create. `orgId` is required for ORG and optional for TEAM (it must match the team's
 * org); GLOBAL and OWN send neither.
 */
export const GrantRequestSchema = z.object({
  roleId: z.number().int().positive(),
  scope: ScopeTypeSchema,
  orgId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
});
export type GrantRequest = z.infer<typeof GrantRequestSchema>;

export const CreateUserCommandSchema = z.object({
  userId: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string().optional(),
  positionName: z.string().optional(),
  orgId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  /** At least 6 characters and at most 72 UTF-8 bytes; the user must change it at first login. */
  initialPassword: z.string(),
  initialRoleGrants: z.array(GrantRequestSchema).optional(),
});
export type CreateUserCommand = z.infer<typeof CreateUserCommandSchema>;

/**
 * `PATCH /users/{userId}`: a field left out keeps its value, `null` clears `email`,
 * `positionName`, `orgId` or `teamId`. Moving a user to another org or team revokes the grants
 * scoped to the old one.
 */
export const UpdateUserCommandSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().nullable().optional(),
  positionName: z.string().nullable().optional(),
  orgId: z.number().int().positive().nullable().optional(),
  teamId: z.number().int().positive().nullable().optional(),
});
export type UpdateUserCommand = z.infer<typeof UpdateUserCommandSchema>;

export const SetUserStatusCommandSchema = z.object({
  status: AccountStatusSchema,
});
export type SetUserStatusCommand = z.infer<typeof SetUserStatusCommandSchema>;

export const CreatedGrantSchema = z.object({ grantId: z.number().int() });
export type CreatedGrant = z.infer<typeof CreatedGrantSchema>;
