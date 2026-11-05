import { z } from 'zod';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordByteLength,
} from '../auth/auth-v1.schema';
import { PageQuerySchema } from '../http/page';

// Mirrors the backend's access requests (/api/v1/access-requests): what a visitor asked for from
// the sign-in page, waiting for an administrator. A row never carries a password or its hash;
// the server keeps the hash of a registration request and never sends it.

export const AccessRequestKindSchema = z.enum(['REGISTER', 'PASSWORD_RESET']);
export type AccessRequestKind = z.infer<typeof AccessRequestKindSchema>;

export const AccessRequestStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
]);
export type AccessRequestStatus = z.infer<typeof AccessRequestStatusSchema>;

/** A row of the requests list. Strict, so a stray `passwordHash` fails the parse. */
export const AccessRequestSchema = z.strictObject({
  requestId: z.number().int(),
  kind: AccessRequestKindSchema,
  status: AccessRequestStatusSchema,
  /** The staff code asked for (register) or asked about (reset); keep it a string. */
  staffCode: z.string(),
  /** Registration only. */
  fullName: z.string().nullish(),
  email: z.string().nullish(),
  /** The unit asked for (register) or the account's unit (reset); null when none. */
  orgId: z.number().int().nullish(),
  orgName: z.string().nullish(),
  /** A reset request: the account it matched, null when no account has that code. */
  targetUserId: z.string().nullish(),
  /** False for a reset request that matched no account; the admin can only reject it. */
  accountFound: z.boolean(),
  createdTime: z.iso.datetime({ offset: true, local: true }),
  resolvedBy: z.string().nullish(),
  resolvedTime: z.iso.datetime({ offset: true, local: true }).nullish(),
  resolutionNote: z.string().nullish(),
});
export type AccessRequest = z.infer<typeof AccessRequestSchema>;

/** The list filters; `q` matches name, staff code and email, at most 100 characters. */
export const AccessRequestsQuerySchema = PageQuerySchema.extend({
  kind: AccessRequestKindSchema.optional(),
  status: AccessRequestStatusSchema.optional(),
  q: z.string().optional(),
});
export type AccessRequestsQuery = z.infer<typeof AccessRequestsQuerySchema>;

/** Field rules of the reject command; the dialog and the schema share them. */
export const ACCESS_REQUEST_LIMITS = { note: 500 } as const;

export const RejectAccessRequestCommandSchema = z.object({
  note: z.string().max(ACCESS_REQUEST_LIMITS.note).optional(),
});
export type RejectAccessRequestCommand = z.infer<
  typeof RejectAccessRequestCommandSchema
>;

/** Approve a pending registration, with an optional note; the server creates the account. */
export const ApproveAccessRequestCommandSchema = z.object({
  note: z.string().max(ACCESS_REQUEST_LIMITS.note).optional(),
});
export type ApproveAccessRequestCommand = z.infer<
  typeof ApproveAccessRequestCommandSchema
>;

/** Field rules of the public registration form; the form and the schema share them. */
export const REGISTRATION_LIMITS = {
  staffCode: 20,
  fullName: 255,
  email: 100,
} as const;

/** A staff code as the backend takes it: letters, digits, dot, underscore and dash. */
export const STAFF_CODE_PATTERN = /^[A-Za-z0-9._-]{1,20}$/;

/**
 * `POST /auth/register-request` (public). The password travels once, over TLS, and the server
 * stores only its hash; no response ever carries it. The "confirm password" field of the form is
 * checked in the browser and is not part of the command.
 */
export const RegisterRequestCommandSchema = z.strictObject({
  staffCode: z.string().regex(STAFF_CODE_PATTERN),
  fullName: z.string().trim().min(1).max(REGISTRATION_LIMITS.fullName),
  email: z.email().max(REGISTRATION_LIMITS.email),
  orgId: z.number().int().positive(),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH)
    .refine((v) => passwordByteLength(v) <= PASSWORD_MAX_BYTES),
});
export type RegisterRequestCommand = z.infer<
  typeof RegisterRequestCommandSchema
>;

/** The one answer of the register request, whether or not the code already has an account. */
export const RegisterRequestResultSchema = z.strictObject({
  message: z.string(),
});
export type RegisterRequestResult = z.infer<typeof RegisterRequestResultSchema>;

/** A unit a visitor can register into (`GET /auth/registration-units`, public): id and name only. */
export const RegistrationUnitSchema = z.strictObject({
  orgId: z.number().int(),
  name: z.string(),
});
export type RegistrationUnit = z.infer<typeof RegistrationUnitSchema>;

/**
 * `POST /auth/password-reset-request` (public): only the staff code. The answer is the same
 * message whether or not an account has that code.
 */
export const PasswordResetRequestCommandSchema = z.strictObject({
  staffCode: z.string().regex(STAFF_CODE_PATTERN),
});
export type PasswordResetRequestCommand = z.infer<
  typeof PasswordResetRequestCommandSchema
>;

export const PasswordResetRequestResultSchema = z.strictObject({
  message: z.string(),
});
export type PasswordResetRequestResult = z.infer<
  typeof PasswordResetRequestResultSchema
>;

/** Reset a password for a pending request, with an optional note. */
export const ResetPasswordCommandSchema = z.object({
  note: z.string().max(ACCESS_REQUEST_LIMITS.note).optional(),
});
export type ResetPasswordCommand = z.infer<typeof ResetPasswordCommandSchema>;

/**
 * The one answer that carries a secret: the temporary password, shown to the admin once. It is
 * never part of a request row and no other response has it.
 */
export const ResetPasswordResultSchema = z.strictObject({
  request: AccessRequestSchema,
  temporaryPassword: z.string().min(1),
});
export type ResetPasswordResult = z.infer<typeof ResetPasswordResultSchema>;
