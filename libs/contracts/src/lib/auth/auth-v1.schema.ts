import { z } from 'zod';
import {
  AccountStatusSchema,
  FunctionInfoSchema,
  GrantScopeSchema,
} from '../identity/identity.schema';

// Mirrors the backend's OpenAPI ("CORE Academy API", /api/v1/auth/*). The schemas describe the `data` of
// each envelope; `envelopeInterceptor` unwraps it. Every org and team field of the user is nullable or may be absent; branch fields are not read
// and parsing strips them.

/**
 * The wire payload; the login form checks that both fields are filled (`@NotBlank`), and the
 * server answers a wrong pair with IDENTITY-CREDENTIALS_INVALID.
 */
export const LoginV1CommandSchema = z.object({
  /** Username or staff code. */
  username: z.string(),
  password: z.string(),
});
export type LoginV1Command = z.infer<typeof LoginV1CommandSchema>;

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.string(),
  expiresInSeconds: z.number().int(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const UserInfoSchema = z.object({
  /** The staff code; keep it a string, it has leading zeros. */
  userId: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  status: AccountStatusSchema,
  authProvider: z.enum(['LOCAL', 'SSO']),
  /** True for a temporary password: every screen except the password change is refused (403). */
  mustChangePassword: z.boolean(),
  orgId: z.number().int().nullish(),
  orgCode: z.string().nullish(),
  orgName: z.string().nullish(),
  orgType: z.string().nullish(),
  teamId: z.number().int().nullish(),
  teamCode: z.string().nullish(),
  teamName: z.string().nullish(),
  positionName: z.string().nullish(),
  lastSyncTime: z.iso.datetime({ offset: true, local: true }).nullish(),
});
export type UserInfo = z.infer<typeof UserInfoSchema>;

/** Field lengths the backend enforces on the profile (`ProfileUpdateRequest`). */
export const PROFILE_LIMITS = {
  fullName: 255,
  email: 100,
  positionName: 255,
} as const;

/**
 * `PATCH /auth/me`: a field left out keeps its value and `null` clears `email` or `positionName`;
 * `fullName` can never be null. The body lists only what changed (see `toPatch`).
 */
export const UpdateMeCommandSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().nullable().optional(),
  positionName: z.string().nullable().optional(),
});
export type UpdateMeCommand = z.infer<typeof UpdateMeCommandSchema>;

/** Password rules of the backend (`@Size(min = 6, max = 72)`, and bcrypt reads at most 72 bytes). */
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_BYTES = 72;

/** Length of a password as bcrypt counts it: UTF-8 bytes, not characters. */
export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

/** `PUT /auth/password`; success revokes every token, so the user signs in again. */
export const ChangePasswordV1CommandSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
});
export type ChangePasswordV1Command = z.infer<
  typeof ChangePasswordV1CommandSchema
>;

export const RoleGrantSchema = z.object({
  roleCode: z.string(),
  roleName: z.string(),
  scope: GrantScopeSchema,
});
export type RoleGrant = z.infer<typeof RoleGrantSchema>;

/** The signed-in user as the backend describes them. */
export const MeSchema = z.object({
  user: UserInfoSchema,
  roles: z.array(z.string()),
  functions: z.array(z.string()),
  roleGrants: z.array(RoleGrantSchema),
  functionDetails: z.array(FunctionInfoSchema),
  /** Keyed by function code. */
  functionScopes: z.record(z.string(), z.array(GrantScopeSchema)),
});
export type Me = z.infer<typeof MeSchema>;
