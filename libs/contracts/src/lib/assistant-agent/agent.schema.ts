import { z } from 'zod';
import { MeSchema } from '../auth/auth-v1.schema';
import { CitationSchema } from '../knowledge/knowledge.schema';

/** The widget's form limit for the message. */
export const AGENT_MESSAGE_MAX_LENGTH = 500;

/** The skills the server knows; the app names one when it already knows what the question is for. */
export const AgentSkillSchema = z.enum([
  'qa_tai_lieu',
  'dieu_huong',
  'ho_so',
  /** Only with a lesson `context`: the server ignores it elsewhere. */
  'tom_tat_bai',
  'tro_chuyen',
]);
export type AgentSkill = z.infer<typeof AgentSkillSchema>;

/** The lesson the quick chat was opened from; the server checks the user may read it. */
export const LessonContextSchema = z.object({
  courseId: z.number().int().positive(),
  revisionId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
});
export type LessonContext = z.infer<typeof LessonContextSchema>;

/**
 * The new question and, for a follow-up, the conversation it belongs to. The client sends no
 * history: the server loads the earlier turns of that conversation itself.
 */
export const AgentCommandSchema = z.object({
  conversationId: z.number().int().positive().nullish(),
  message: z.string().trim().min(1).max(AGENT_MESSAGE_MAX_LENGTH),
  /** Left out, the server picks the skill itself. */
  skill: AgentSkillSchema.optional(),
  /** The lesson being studied; sent with every question of a conversation opened from it. */
  context: LessonContextSchema.optional(),
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
  /** The first line of every stream: the conversation this turn is stored in. */
  z.object({
    type: z.literal('conversation'),
    conversationId: z.number().int().positive(),
  }),
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
    /** The stored turn, which the user may rate; absent when the server could not store it. */
    turnId: z.number().int().positive().optional(),
    /** Up to three follow-up questions; absent when the model offered none. */
    suggestions: z.array(z.string()).optional(),
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
