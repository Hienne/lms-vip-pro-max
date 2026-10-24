import { z } from 'zod';
import { MeSchema } from '../auth/auth-v1.schema';
import { CitationSchema } from '../knowledge/knowledge.schema';

/** The widget's form limit for the last user message; the schema does not trim history. */
export const AGENT_MESSAGE_MAX_LENGTH = 500;
/** Ten turns: five questions and five answers, the backend's cap per request. */
export const AGENT_HISTORY_MESSAGES = 20;

/** History is text only; the backend never takes tool calls or results from the client. */
export const AgentMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentCommandSchema = z.object({
  messages: z
    .array(AgentMessageSchema)
    .min(1)
    .max(AGENT_HISTORY_MESSAGES)
    .refine((messages) => messages.at(-1)?.role === 'user'),
});
export type AgentCommand = z.infer<typeof AgentCommandSchema>;

export const ProfileChangeSchema = z.object({
  field: z.enum(['fullName', 'email', 'positionName']),
  label: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
});
export type ProfileChange = z.infer<typeof ProfileChangeSchema>;

/**
 * A data change the model proposed; nothing has happened until it is confirmed. An unknown tool
 * fails parsing on purpose: the app must never offer to confirm a change it cannot show.
 */
export const PendingActionSchema = z.discriminatedUnion('tool', [
  z.object({
    id: z.string(),
    tool: z.literal('update_profile'),
    title: z.string(),
    changes: z.array(ProfileChangeSchema).min(1),
    expiresAt: z.iso.datetime(),
  }),
]);
export type PendingAction = z.infer<typeof PendingActionSchema>;

/** One line of the NDJSON stream. `tool.name` stays a string so a tool added later still parses. */
export const AgentStreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tool'), name: z.string() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({
    type: z.literal('navigate'),
    path: z.string().startsWith('/'),
    title: z.string(),
  }),
  z.object({ type: z.literal('action_required'), action: PendingActionSchema }),
  z.object({
    type: z.literal('done'),
    /** The final text; it replaces what the deltas added up to. */
    answer: z.string(),
    citations: z.array(CitationSchema),
  }),
  z.object({
    type: z.literal('error'),
    messageCode: z.string(),
    message: z.string(),
  }),
]);
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>;

/** What confirming an action answers: the refreshed profile for `update_profile`. */
export const ActionResultSchema = z.discriminatedUnion('tool', [
  z.object({
    actionId: z.string(),
    tool: z.literal('update_profile'),
    message: z.string(),
    data: MeSchema,
  }),
]);
export type ActionResult = z.infer<typeof ActionResultSchema>;
