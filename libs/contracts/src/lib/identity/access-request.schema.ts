import { z } from 'zod';
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
