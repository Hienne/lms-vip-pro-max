import { z } from 'zod';

// Kết nối trợ lý ngoài (corebanking-academy `assistant/external`, ADR 0004): a token the author
// creates on the web and gives to an outside assistant (Claude Code), which then drafts courses
// through the narrow MCP endpoint `/api/v1/mcp` as that author. The token works on that endpoint only.

/** Whether the feature is on, and whether the caller may make connections (their roles, now). */
export const ExternalAssistantStatusSchema = z.object({
  enabled: z.boolean(),
  allowed: z.boolean(),
});
export type ExternalAssistantStatus = z.infer<
  typeof ExternalAssistantStatusSchema
>;

/** One of the caller's connections that is not revoked; an expired one stays listed. */
export const ExternalConnectionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  /** The first characters of the token (`chan_ext_ab12`), to tell connections apart. */
  tokenPrefix: z.string(),
  createTime: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  /** Updated at most once a minute; null until the connection is first used. */
  lastUsedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ExternalConnection = z.infer<typeof ExternalConnectionSchema>;

/** How long a new connection works, in days. */
export const ConnectionValidDaysSchema = z.union([
  z.literal(30),
  z.literal(90),
]);
export type ConnectionValidDays = z.infer<typeof ConnectionValidDaysSchema>;

export const CreateExternalConnectionCommandSchema = z.object({
  name: z.string().trim().min(1).max(100),
  validDays: ConnectionValidDaysSchema,
});
export type CreateExternalConnectionCommand = z.infer<
  typeof CreateExternalConnectionCommandSchema
>;

/** The new connection and its token: the only time the server ever sends the token. */
export const CreatedExternalConnectionSchema = z.object({
  connection: ExternalConnectionSchema,
  token: z.string().startsWith('chan_ext_'),
});
export type CreatedExternalConnection = z.infer<
  typeof CreatedExternalConnectionSchema
>;

/** The MCP endpoint a connection token works on, on the app's own origin. */
export const EXTERNAL_MCP_PATH = '/api/v1/mcp';
