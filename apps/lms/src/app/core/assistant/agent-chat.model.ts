import {
  CitationSchema,
  FeedbackSchema,
  PendingActionSchema,
  type PendingAction,
} from '@lms/contracts';
import { z } from 'zod';

/**
 * The quick assistant's conversation as the app keeps it: in the browser, per tab. The server
 * owns every answer, citation and action; these types only hold what it streamed so the panel can
 * show it again after a navigation or a reload.
 */

/** Where a reply is: the stream drives every step but `stopped`. */
export const AgentReplyStatusSchema = z.enum([
  'waiting',
  'working',
  'composing',
  'done',
  'stopped',
  'error',
]);
export type AgentReplyStatus = z.infer<typeof AgentReplyStatusSchema>;

export const ActionCardStatusSchema = z.enum([
  'pending',
  'confirming',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
]);
export type ActionCardStatus = z.infer<typeof ActionCardStatusSchema>;

/** A proposed change as the panel shows it; `message` is the server's result or refusal. */
export const ActionCardSchema = z.object({
  pending: PendingActionSchema,
  status: ActionCardStatusSchema,
  message: z.string().nullable(),
  /** Where the confirmed action leads, for example the review screen of a course job. */
  link: z.object({ path: z.string(), label: z.string() }).nullish(),
});
export interface ActionCard {
  readonly pending: PendingAction;
  readonly status: ActionCardStatus;
  readonly message: string | null;
  readonly link?: { readonly path: string; readonly label: string } | null;
}

export const AgentReplySchema = z.object({
  status: AgentReplyStatusSchema,
  /** The last `tool` event, for the status line. */
  toolName: z.string().nullable(),
  text: z.string(),
  citations: z.array(CitationSchema),
  /** False: the answer used documents and marks no source, so the panel labels it. Absent means true. */
  grounded: z.boolean().optional(),
  navigatedTo: z.object({ path: z.string(), title: z.string() }).nullable(),
  action: ActionCardSchema.nullable(),
  error: z.string().nullable(),
});
export type AgentReply = z.infer<typeof AgentReplySchema>;

export const AgentTurnSchema = z.object({
  id: z.number().int().positive(),
  question: z.string(),
  reply: AgentReplySchema,
  /** The turn as the server stored it, once it has: the id feedback is sent against. */
  serverTurnId: z.number().int().positive().optional(),
  /** The user's thumbs on the answer, as the server saved them. */
  feedback: FeedbackSchema.nullable().optional(),
  /** Follow-up questions the server offered with this answer. */
  suggestions: z.array(z.string()).optional(),
  /** The suggestions come from a turn that read shared content: sent with the Q&A skill. */
  suggestionsReadOnly: z.boolean().optional(),
});
export type AgentTurn = z.infer<typeof AgentTurnSchema>;

/**
 * What `sessionStorage` holds for one user: where the panel is and which saved conversation is
 * open. The turns themselves are the server's and are read again on a reload.
 */
export const PersistedChatSchema = z.object({
  open: z.boolean(),
  /** The panel is docked to the right edge on a wide screen; stored only when it is. */
  docked: z.boolean().optional(),
  /** The server conversation the next question continues; absent before the first answer. */
  conversationId: z.number().int().positive().optional(),
});
export type PersistedChat = z.infer<typeof PersistedChatSchema>;
