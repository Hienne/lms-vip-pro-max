import { z } from 'zod';
import { AccountStatusSchema } from '../identity/identity.schema';

// Mirrors the backend's OpenAPI ("CORE Academy API", /api/v1/auth/*). The schemas describe the `data` of
// each envelope; `envelopeInterceptor` unwraps it. Every org and team field of the user is nullable or may be absent; branch fields are not read
// and parsing strips them.

/** Payload only; blank-field rules are enforced by the server (400). */
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

export const GrantScopeSchema = z.object({
  type: z.enum(['GLOBAL', 'ORG', 'TEAM', 'OWN']),
  orgId: z.number().int().nullish(),
  teamId: z.number().int().nullish(),
});
export type GrantScope = z.infer<typeof GrantScopeSchema>;

export const MeUserSchema = z.object({
  /** The staff code; keep it a string, it has leading zeros. */
  userId: z.string(),
  username: z.string(),
  fullName: z.string(),
  email: z.string().nullish(),
  status: AccountStatusSchema.exclude(['suspended']),
  authProvider: z.enum(['LOCAL', 'SSO']),
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
export type MeUser = z.infer<typeof MeUserSchema>;

export const RoleGrantSchema = z.object({
  roleCode: z.string(),
  roleName: z.string(),
  scope: GrantScopeSchema,
});
export type RoleGrant = z.infer<typeof RoleGrantSchema>;

/** An active screen; the backend sorts them by `sortNo`, then `id`. */
export const FunctionInfoSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  routePattern: z.string().nullish(),
  parentFunctionId: z.number().int().nullish(),
  sortNo: z.number().int(),
});
export type FunctionInfo = z.infer<typeof FunctionInfoSchema>;

/** The signed-in user as the backend describes them. */
export const MeSchema = z.object({
  user: MeUserSchema,
  roles: z.array(z.string()),
  functions: z.array(z.string()),
  roleGrants: z.array(RoleGrantSchema),
  functionDetails: z.array(FunctionInfoSchema),
  /** Keyed by function code. */
  functionScopes: z.record(z.string(), z.array(GrantScopeSchema)),
});
export type Me = z.infer<typeof MeSchema>;
