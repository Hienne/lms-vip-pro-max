import { z } from 'zod';
import { CitationSchema } from '../knowledge/knowledge.schema';
import { ProfileChangeSchema } from '../assistant-agent/agent.schema';

// The conversations both assistants keep on the server (CORE Academy API,
// /api/v1/assistant/conversations). The client holds no history of its own: it lists, reopens,
// renames and deletes what the server stored.

/** The longest title a user may give a conversation (the default is the first question cut to it). */
export const CONVERSATION_TITLE_MAX_LENGTH = 80;

/** Which assistant stored the turn: the quick chat or the document Q&A page. */
export const TurnSurfaceSchema = z.enum(['AGENT', 'KNOWLEDGE']);
export type TurnSurface = z.infer<typeof TurnSurfaceSchema>;

/** The lesson a conversation was opened from; `label` is "Khóa › Bài" as it was then. */
export const ConversationContextSchema = z.object({
  courseId: z.number().int().positive(),
  revisionId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  label: z.string(),
});
export type ConversationContext = z.infer<typeof ConversationContextSchema>;

/** One row of the list, newest activity first. */
export const ConversationSummarySchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  lastActivityTime: z.iso.datetime(),
  createTime: z.iso.datetime(),
  /** Absent for a conversation that was not opened from a lesson. */
  context: ConversationContextSchema.optional(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

/** `done` is the only state with a complete answer; `error` and `stopped` may carry none. */
export const StoredTurnStatusSchema = z.enum(['done', 'error', 'stopped']);
export type StoredTurnStatus = z.infer<typeof StoredTurnStatusSchema>;

/**
 * The state of a confirmation card as the server knows it now: `expired` is a card nobody
 * answered in time, `failed` one the user confirmed and the tool then refused.
 */
export const StoredActionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'cancelled',
  'expired',
  'failed',
]);
export type StoredActionStatus = z.infer<typeof StoredActionStatusSchema>;

/** The card a turn proposed. An unknown tool fails parsing, like a live card does. */
export const StoredActionSchema = z.discriminatedUnion('tool', [
  z.object({
    id: z.string(),
    tool: z.literal('update_profile'),
    title: z.string(),
    changes: z.array(ProfileChangeSchema),
    status: StoredActionStatusSchema,
    expiresAt: z.iso.datetime(),
    /** The result shown after confirming, or why the tool refused; null while there is none. */
    message: z.string().nullable(),
  }),
  z.object({
    id: z.string(),
    tool: z.literal('start_course_job'),
    title: z.string(),
    changes: z.array(ProfileChangeSchema.extend({ field: z.string() })),
    status: StoredActionStatusSchema,
    expiresAt: z.iso.datetime(),
    message: z.string().nullable(),
  }),
]);
export type StoredAction = z.infer<typeof StoredActionSchema>;

/** Why a user marked an answer as not good; the labels are the UI copy for each code. */
export const FeedbackReasonSchema = z.enum([
  'incorrect',
  'irrelevant',
  'outdated',
  'missing_source',
  'other',
]);
export type FeedbackReason = z.infer<typeof FeedbackReasonSchema>;

export const FEEDBACK_NOTE_MAX_LENGTH = 2000;

/** The thumbs a user gave one answer; a reason and a note only go with a thumbs-down. */
export const FeedbackSchema = z.object({
  helpful: z.boolean(),
  reasonCode: FeedbackReasonSchema.nullable(),
  note: z.string().nullable(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

/** What the user sends: one per turn, sent again to change it. */
export const RateAnswerCommandSchema = z.object({
  helpful: z.boolean(),
  reasonCode: FeedbackReasonSchema.optional(),
  note: z.string().max(FEEDBACK_NOTE_MAX_LENGTH).optional(),
});
export type RateAnswerCommand = z.infer<typeof RateAnswerCommandSchema>;

export const StoredTurnSchema = z.object({
  id: z.number().int().positive(),
  surface: TurnSurfaceSchema,
  question: z.string(),
  /** Null when the turn failed or was stopped before any answer. */
  answer: z.string().nullable(),
  citations: z.array(CitationSchema),
  toolNames: z.array(z.string()),
  /** The screen the assistant opened in this turn. */
  navigation: z.object({ path: z.string(), title: z.string() }).nullable(),
  actionId: z.string().nullable(),
  action: StoredActionSchema.nullable(),
  /** The user's own thumbs on this answer; null until they give one. */
  feedback: FeedbackSchema.nullable(),
  status: StoredTurnStatusSchema,
  createTime: z.iso.datetime(),
});
export type StoredTurn = z.infer<typeof StoredTurnSchema>;

/** A conversation with its turns, oldest first. */
export const ConversationDetailSchema = ConversationSummarySchema.extend({
  turns: z.array(StoredTurnSchema),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const ConversationListQuerySchema = z.object({
  page: z.number().int().min(0).optional(),
  size: z.number().int().min(1).max(100).optional(),
  /** Matches titles only, never the text of questions or answers. */
  q: z.string().optional(),
});
export type ConversationListQuery = z.infer<typeof ConversationListQuerySchema>;

export const RenameConversationCommandSchema = z.object({
  title: z.string().trim().min(1).max(CONVERSATION_TITLE_MAX_LENGTH),
});
export type RenameConversationCommand = z.infer<
  typeof RenameConversationCommandSchema
>;
