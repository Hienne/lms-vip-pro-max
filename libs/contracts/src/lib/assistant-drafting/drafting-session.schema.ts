import { z } from 'zod';
import { TargetInputSchema } from '../assignment/assignment.schema';
import {
  CourseLevelSchema,
  CreateCourseCommandSchema,
  RequirementSchema,
  SaveDraftCommandSchema,
} from '../course/course.schema';

// A drafting session ("Soạn cùng trợ lý", corebanking-academy `assistant/drafting`): the server
// proposes a new course one editor step at a time from a private source document, and the author
// confirms each step with the page's own values. Steps are numbered 1..4; the editor's step index
// is `step - 1`. Proposal field names are the course DTOs' (`defaultRequirement`, `programId`…).

/** Where one step stands. A `proposing` step with no proposal yet is still being worked on. */
export const DraftingStepStateSchema = z.enum([
  'proposing',
  'proposed',
  'confirmed',
  'failed',
  'manual',
]);
export type DraftingStepState = z.infer<typeof DraftingStepStateSchema>;

/** `manual`: the author stopped the assistant and fills the remaining steps by hand. */
export const DraftingSessionStatusSchema = z.enum([
  'active',
  'finished',
  'manual',
  'failed',
]);
export type DraftingSessionStatus = z.infer<typeof DraftingSessionStatusSchema>;

export const DraftingStepNumberSchema = z.number().int().min(1).max(4);
export type DraftingStepNumber = 1 | 2 | 3 | 4;

/** The step 1 fields the assistant may leave for the author to check. */
export const BasicsFieldSchema = z.enum([
  'title',
  'summary',
  'objectives',
  'level',
  'defaultRequirement',
  'programId',
  'moduleId',
]);
export type BasicsField = z.infer<typeof BasicsFieldSchema>;

/**
 * Step 1, the course info. Programme and module are ids the author may pick, or null when the
 * server dropped what the model returned; `code` is generated and checked free by the server.
 */
export const BasicsProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  objectives: z.array(z.string()),
  level: CourseLevelSchema.nullable(),
  defaultRequirement: RequirementSchema.nullable(),
  programId: z.number().int().positive().nullable(),
  moduleId: z.number().int().positive().nullable(),
  code: z.string(),
  unsure: z.array(BasicsFieldSchema),
});
export type BasicsProposal = z.infer<typeof BasicsProposalSchema>;

/** One proposed lesson; `sourceSection` is the title of the source section it comes from. */
export const OutlineLessonProposalSchema = z.object({
  title: z.string(),
  description: z.string(),
  sourceSection: z.string(),
});
export type OutlineLessonProposal = z.infer<typeof OutlineLessonProposalSchema>;

/** Step 2, chapters and lessons. Lessons are saved with empty content. */
export const OutlineProposalSchema = z.object({
  chapters: z.array(
    z.object({
      title: z.string(),
      lessons: z.array(OutlineLessonProposalSchema),
    }),
  ),
});
export type OutlineProposal = z.infer<typeof OutlineProposalSchema>;

/** A saved lesson's description and source, kept on the session once step 2 is confirmed. */
export const LessonNoteSchema = z.object({
  lessonId: z.number().int(),
  description: z.string(),
  sourceSection: z.string(),
});
export type LessonNote = z.infer<typeof LessonNoteSchema>;

/** A draft final exam question, the shape of the question generation schema. */
export const DraftQuestionSchema = z.object({
  type: z.enum(['SINGLE', 'MULTIPLE']),
  content: z.string(),
  explanation: z.string().nullable(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  options: z.array(z.object({ content: z.string(), correct: z.boolean() })),
  sourceSection: z.string(),
});
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>;

/** Step 3, completion rules. Questions reach the bank only when the step is confirmed. */
export const RulesProposalSchema = z.object({
  rewardPoints: z.number().int().min(0),
  competencyId: z.number().int().positive().nullable(),
  questions: z.array(DraftQuestionSchema),
});
export type RulesProposal = z.infer<typeof RulesProposalSchema>;

/** One proposed audience row: a target input with the label the page shows (`TargetPick`). */
export const DraftTargetSchema = TargetInputSchema.extend({
  label: z.string(),
});
export type DraftTarget = z.infer<typeof DraftTargetSchema>;

/**
 * Step 4, who the course is for, and what still blocks publishing (the editor's pre-publish
 * check, computed by the server from the saved draft). Nothing is assigned or published.
 */
export const AudienceProposalSchema = z.object({
  targets: z.array(DraftTargetSchema),
  publishBlockers: z.array(z.string()),
});
export type AudienceProposal = z.infer<typeof AudienceProposalSchema>;

const stepFields = {
  state: DraftingStepStateSchema,
  /** Vietnamese lines for the chat message ("Chưa chọn được chương trình…"). */
  notes: z.array(z.string()),
  error: z.string().nullable(),
  updateTime: z.iso.datetime({ offset: true }),
};

/** One reached step, its proposal shape chosen by `step`. */
export const DraftingStepSchema = z.discriminatedUnion('step', [
  z.object({
    step: z.literal(1),
    proposal: BasicsProposalSchema.nullable(),
    ...stepFields,
  }),
  z.object({
    step: z.literal(2),
    proposal: OutlineProposalSchema.nullable(),
    /** Set once the outline is confirmed, by saved lesson id. */
    lessonNotes: z.array(LessonNoteSchema).nullish(),
    ...stepFields,
  }),
  z.object({
    step: z.literal(3),
    proposal: RulesProposalSchema.nullable(),
    ...stepFields,
  }),
  z.object({
    step: z.literal(4),
    proposal: AudienceProposalSchema.nullable(),
    ...stepFields,
  }),
]);
export type DraftingStep = z.infer<typeof DraftingStepSchema>;

/** The private source document (`course_source` scope: only its uploader sees it). */
export const DraftingSourceSchema = z.object({
  documentId: z.number().int(),
  fileName: z.string(),
  status: z.string(),
});
export type DraftingSource = z.infer<typeof DraftingSourceSchema>;

export const DraftingSessionSchema = z.object({
  id: z.number().int(),
  status: DraftingSessionStatusSchema,
  currentStep: DraftingStepNumberSchema,
  /** The draft course, once step 1 is confirmed. */
  courseId: z.number().int().nullable(),
  revisionId: z.number().int().nullable(),
  /** The chat conversation that started the session, which gets a message per step. */
  conversationId: z.number().int().nullable(),
  source: DraftingSourceSchema.nullable(),
  error: z.string().nullable(),
  /** Only the steps reached, in ascending order. */
  steps: z.array(DraftingStepSchema),
  createTime: z.iso.datetime({ offset: true }),
  updateTime: z.iso.datetime({ offset: true }),
});
export type DraftingSession = z.infer<typeof DraftingSessionSchema>;

/** Optional hints sent with the document; `ownerOrgId` only by an admin. */
export const StartDraftingFieldsSchema = z.object({
  title: z.string().trim().max(255).optional(),
  targetLearners: z.string().trim().max(500).optional(),
  level: CourseLevelSchema.optional(),
  ownerOrgId: z.number().int().positive().optional(),
});
export type StartDraftingFields = z.infer<typeof StartDraftingFieldsSchema>;

/** `fields` is the JSON text of {@link StartDraftingFields}, sent as one form field. */
export const StartDraftingCommandSchema = z.object({
  file: z.file(),
  fields: z.string().optional(),
  conversationId: z.number().int().optional(),
});
export type StartDraftingCommand = z.infer<typeof StartDraftingCommandSchema>;

/** The chat's attachment, uploaded before the assistant starts a session from it. */
export const UploadDraftingSourceCommandSchema = z.object({
  file: z.file(),
});
export type UploadDraftingSourceCommand = z.infer<
  typeof UploadDraftingSourceCommandSchema
>;

/** Step 1: creates the draft course through the normal create path. */
export const ConfirmBasicsCommandSchema = z.object({
  course: CreateCourseCommandSchema,
});
export type ConfirmBasicsCommand = z.infer<typeof ConfirmBasicsCommandSchema>;

/** Step 2: saves the draft tree; proposed lessons keep `blocks: []`. */
export const ConfirmOutlineCommandSchema = z.object({
  draft: SaveDraftCommandSchema,
});
export type ConfirmOutlineCommand = z.infer<typeof ConfirmOutlineCommandSchema>;

/** Step 3: saves the rules and creates the final exam from the kept (and edited) questions. */
export const ConfirmRulesCommandSchema = z.object({
  draft: SaveDraftCommandSchema,
  competencyId: z.number().int().positive(),
  questions: z.array(DraftQuestionSchema),
});
export type ConfirmRulesCommand = z.infer<typeof ConfirmRulesCommandSchema>;

/** Step 4 stores nothing on the course: it ends the session. */
export const ConfirmAudienceCommandSchema = z.object({});
export type ConfirmAudienceCommand = z.infer<
  typeof ConfirmAudienceCommandSchema
>;

export const ConfirmDraftingStepCommandSchema = z.union([
  ConfirmBasicsCommandSchema,
  ConfirmOutlineCommandSchema,
  ConfirmRulesCommandSchema,
  ConfirmAudienceCommandSchema,
]);
export type ConfirmDraftingStepCommand = z.infer<
  typeof ConfirmDraftingStepCommandSchema
>;

/** The card on a chat step message; its state is read live from the session. */
export const DraftingCardSchema = z.object({
  sessionId: z.number().int(),
  step: DraftingStepNumberSchema,
  state: DraftingStepStateSchema,
  courseId: z.number().int().nullable(),
});
export type DraftingCard = z.infer<typeof DraftingCardSchema>;
