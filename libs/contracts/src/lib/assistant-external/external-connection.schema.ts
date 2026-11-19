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

/**
 * How a connection was made: `token`, a pasted `chan_ext_` code (ADR 0004), or `oauth`, granted on
 * the Cho phép kết nối page (ADR 0005).
 */
export const ExternalConnectionKindSchema = z.enum(['token', 'oauth']);
export type ExternalConnectionKind = z.infer<
  typeof ExternalConnectionKindSchema
>;

/** One of the caller's connections that is not revoked; an expired one stays listed. */
export const ExternalConnectionSchema = z.object({
  id: z.number().int(),
  /** The name the author gave a `token` connection, or the name an `oauth` client gave itself. */
  name: z.string(),
  kind: ExternalConnectionKindSchema,
  /** The first characters of a `token` connection's code (`chan_ext_ab12`); null for `oauth`. */
  tokenPrefix: z.string().nullable(),
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

/** A pending authorization the Cho phép kết nối page shows (`/api/v1/assistant/oauth-requests/{id}`). */
export const OAuthConsentRequestSchema = z.object({
  /** The name the client gave itself; CHAN Academy does not verify it. */
  clientName: z.string(),
  /** Where the browser goes back to: `claude.ai`, `claude.com`, or the user's machine (`127.0.0.1`). */
  redirectHost: z.string(),
  /** Days a connection lasts unused. */
  idleDays: z.number().int(),
  /** The user already holds `maxConnections` live connections. */
  atLimit: z.boolean(),
  maxConnections: z.number().int(),
});
export type OAuthConsentRequest = z.infer<typeof OAuthConsentRequestSchema>;

/** Where the browser goes after Cho phép or Từ chối: the client's redirect URI with a code or an error. */
export const OAuthConsentResultSchema = z.object({
  redirectUrl: z.url(),
});
export type OAuthConsentResult = z.infer<typeof OAuthConsentResultSchema>;
