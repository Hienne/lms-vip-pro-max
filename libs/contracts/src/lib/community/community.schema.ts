import { z } from 'zod';
import { BackendDateTimeSchema } from '../http/datetime';
import { PageQuerySchema } from '../http/page';

// Mirrors the backend's community API (/api/v1/community, `docs/api/COMMUNITY.md` and the records
// in `community/dto/`). The server decides who may do what (`capabilities`), the counts, the
// resolution status and every version; the app renders them and echoes versions back on writes.

/** Limits the backend enforces, shared by the request schemas and the forms. */
export const COMMUNITY_LIMITS = {
  title: { min: 5, max: 255 },
  /** A draft may be empty; publishing needs `min`. */
  body: { min: 20, max: 100_000 },
  summary: { max: 2_000 },
  comment: { max: 10_000 },
  /** A lifecycle, duplicate, report-action or moderator reason. */
  reason: { min: 5, max: 3_000 },
  reportDescription: { max: 3_000 },
  reasonCode: { max: 100 },
  changeNote: { max: 500 },
  tags: { max: 10 },
  assets: { max: 20 },
  technologies: { max: 20 },
  lesson: {
    symptoms: { min: 20, max: 10_000 },
    rootCause: { min: 20, max: 10_000 },
    resolution: { min: 20, max: 20_000 },
    prevention: { min: 20, max: 10_000 },
  },
  suggestionQuery: { min: 5, max: 300 },
} as const;

// ---- Enums -----------------------------------------------------------------------------------

export const ContentKindSchema = z.enum([
  'question',
  'answer',
  'article',
  'lesson_learned',
]);
export type ContentKind = z.infer<typeof ContentKindSchema>;

/** Kinds this app creates or lists; the server has more (wiki, radar, review, ...). */
export const KNOWN_CONTENT_KINDS = ContentKindSchema.options;

export const ResolutionStatusSchema = z.enum([
  'unanswered',
  'answered',
  'solved',
]);
export type ResolutionStatus = z.infer<typeof ResolutionStatusSchema>;

export const LifecycleStatusSchema = z.enum([
  'active',
  'closed',
  'archived',
  'hidden',
  'deleted',
]);
export type LifecycleStatus = z.infer<typeof LifecycleStatusSchema>;

export const VisibilitySchema = z.enum(['organization', 'guild', 'restricted']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const LifecycleActionSchema = z.enum([
  'close',
  'reopen',
  'archive',
  'unarchive',
  'soft_delete',
]);
export type LifecycleAction = z.infer<typeof LifecycleActionSchema>;

export const SubscriptionModeSchema = z.enum([
  'instant',
  'digest',
  'muted',
  'off',
]);
export type SubscriptionMode = z.infer<typeof SubscriptionModeSchema>;

export const CommunityReportStatusSchema = z.enum([
  'open',
  'in_review',
  'resolved',
  'dismissed',
]);
export type CommunityReportStatus = z.infer<typeof CommunityReportStatusSchema>;

export const ModerationActionSchema = z.enum([
  'hide',
  'restore',
  'restore_deleted',
  'soft_delete',
  'close',
  'assign_maintainer',
  'warn',
  'dismiss',
]);
export type ModerationAction = z.infer<typeof ModerationActionSchema>;

export const ReportTargetKindSchema = z.enum([
  'question',
  'answer',
  'article',
  'lesson',
  'comment',
]);
export type ReportTargetKind = z.infer<typeof ReportTargetKindSchema>;

export const ModeratorStatusSchema = z.enum(['active', 'revoked']);
export type ModeratorStatus = z.infer<typeof ModeratorStatusSchema>;

// ---- Views -----------------------------------------------------------------------------------

export const PersonRefSchema = z.object({
  /** The staff code: a string whose leading zeros matter. */
  userId: z.string(),
  displayName: z.string().nullish(),
});
export type PersonRef = z.infer<typeof PersonRefSchema>;

export const TagViewSchema = z.object({
  tagId: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  status: z.string(),
  aliases: z.array(z.string()).nullish(),
  version: z.number().int().nullish(),
  mergedIntoTagId: z.number().int().nullish(),
  usageCount: z.number().int().nullish(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type TagView = z.infer<typeof TagViewSchema>;

/** A link to a content, as the server builds it (`url` is an app path). */
export const ContentRefSchema = z.object({
  contentId: z.number().int(),
  kind: z.string(),
  revisionId: z.number().int().nullish(),
  title: z.string().nullish(),
  url: z.string().nullish(),
});
export type ContentRef = z.infer<typeof ContentRefSchema>;

/** What the caller may do on a content; the UI renders these flags and never decides itself. */
export const CapabilitiesSchema = z.object({
  canEditDraft: z.boolean(),
  canPublish: z.boolean(),
  canAnswer: z.boolean(),
  canComment: z.boolean(),
  canVote: z.boolean(),
  canAccept: z.boolean(),
  canManageAccess: z.boolean(),
  canReport: z.boolean(),
  canClose: z.boolean(),
  canReopen: z.boolean(),
  canArchive: z.boolean(),
  canDelete: z.boolean(),
  canMarkDuplicate: z.boolean(),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const TechnologySchema = z.object({
  name: z.string(),
  version: z.string().nullish(),
});

/** The structured body of a lesson learned (an incident write-up). */
export const LessonLearnedSchema = z.object({
  occurredOn: z.string().nullish(),
  symptoms: z.string().nullish(),
  rootCause: z.string().nullish(),
  resolution: z.string().nullish(),
  prevention: z.string().nullish(),
});
export type LessonLearned = z.infer<typeof LessonLearnedSchema>;

/** The `context` of a revision; keys the app does not know are dropped. */
export const ContentContextSchema = z.object({
  review: z
    .object({
      problem: z.string().optional(),
      constraints: z.string().optional(),
      decisionsNeeded: z.array(z.string()).optional(),
    })
    .nullish(),
  technologies: z.array(TechnologySchema).nullish(),
  environment: z.string().nullish(),
  limitations: z.string().nullish(),
  lessonLearned: LessonLearnedSchema.nullish(),
});
export type ContentContext = z.infer<typeof ContentContextSchema>;

export const RevisionAssetViewSchema = z.object({
  revisionAssetId: z.number().int(),
  assetId: z.number().int(),
  usage: z.string(),
  caption: z.string().nullish(),
  altText: z.string().nullish(),
  sortNo: z.number().int().nullish(),
});
export type RevisionAssetView = z.infer<typeof RevisionAssetViewSchema>;

export const RevisionDetailSchema = z.object({
  revisionId: z.number().int(),
  contentId: z.number().int(),
  revisionNo: z.number().int(),
  title: z.string(),
  bodyMarkdown: z.string(),
  summary: z.string().nullish(),
  context: ContentContextSchema.nullish(),
  revisionStatus: z.string(),
  publishedAt: BackendDateTimeSchema.nullish(),
  revisionVersion: z.number().int(),
  contentVersion: z.number().int(),
  assets: z.array(RevisionAssetViewSchema).nullish(),
  /** The note the editor left when saving this revision. */
  changeNote: z.string().nullish(),
  editor: PersonRefSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type RevisionDetail = z.infer<typeof RevisionDetailSchema>;

/** One row of a content list (questions, answers, articles, lessons, mine, saved). */
export const ContentCardSchema = z.object({
  coverRevisionAssetId: z.number().int().positive().nullish(),
  contentId: z.number().int(),
  kind: z.string(),
  title: z.string(),
  summary: z.string().nullish(),
  authorUserId: z.string().nullish(),
  lifecycleStatus: z.string(),
  visibility: z.string().nullish(),
  primaryGuildId: z.number().int().nullish(),
  publishedAt: BackendDateTimeSchema.nullish(),
  lastActivityAt: BackendDateTimeSchema.nullish(),
  contentVersion: z.number().int(),
  publishedRevisionId: z.number().int().nullish(),
  author: PersonRefSchema.nullish(),
  tags: z.array(TagViewSchema).nullish(),
  score: z.number().int(),
  myVote: z.number().int(),
  capabilities: CapabilitiesSchema.nullish(),
  resolutionStatus: z.string().nullish(),
  answerCount: z.number().int(),
  acceptedAnswerId: z.number().int().nullish(),
  isDuplicate: z.boolean().nullish(),
  duplicateTarget: ContentRefSchema.nullish(),
  /** Answers only: the question they belong to. */
  questionId: z.number().int().nullish(),
  revisionId: z.number().int().nullish(),
  isAccepted: z.boolean().nullish(),
  acceptedRevisionId: z.number().int().nullish(),
  acceptedRevisionIsCurrent: z.boolean().nullish(),
  /** The author has an unpublished draft of this content (My posts). */
  hasDraft: z.boolean().nullish(),
  /** Lessons learned: the day the incident happened. */
  occurredOn: z.string().nullish(),
});
export type ContentCard = z.infer<typeof ContentCardSchema>;

/**
 * How a closed question was closed: `close`, `duplicate`, or `moderated` (a moderator acting on a
 * report case; then `reason` and `actor` are null).
 */
export const ClosureSchema = z.object({
  action: z.string(),
  reason: z.string().nullish(),
  actor: PersonRefSchema.nullish(),
  occurredAt: BackendDateTimeSchema.nullish(),
});
export type Closure = z.infer<typeof ClosureSchema>;

export const ContentDetailSchema = z.object({
  contentId: z.number().int(),
  kind: z.string(),
  ownerOrgId: z.number().int(),
  author: PersonRefSchema.nullish(),
  maintainer: PersonRefSchema.nullish(),
  lifecycleStatus: z.string(),
  visibility: z.string(),
  primaryGuildId: z.number().int().nullish(),
  contentVersion: z.number().int(),
  publishedRevision: RevisionDetailSchema.nullish(),
  draftRevision: RevisionDetailSchema.nullish(),
  tags: z.array(TagViewSchema).nullish(),
  capabilities: CapabilitiesSchema,
  resolutionStatus: z.string().nullish(),
  acceptedAnswerId: z.number().int().nullish(),
  acceptedRevisionId: z.number().int().nullish(),
  acceptedRevisionIsCurrent: z.boolean(),
  answerCount: z.number().int(),
  score: z.number().int(),
  myVote: z.number().int(),
  /** The caller has bookmarked it. */
  saved: z.boolean(),
  /** The caller's follow mode, or null when not following. */
  subscriptionMode: SubscriptionModeSchema.nullish(),
  isDuplicate: z.boolean(),
  duplicateTarget: ContentRefSchema.nullish(),
  closure: ClosureSchema.nullish(),
  /** Answers only: the question they belong to. */
  questionId: z.number().int().nullish(),
});
export type ContentDetail = z.infer<typeof ContentDetailSchema>;

export const VoteViewSchema = z.object({
  contentId: z.number().int(),
  score: z.number().int(),
  upvotes: z.number().int(),
  downvotes: z.number().int(),
  myVote: z.number().int(),
});
export type VoteView = z.infer<typeof VoteViewSchema>;

export const CommentViewSchema = z.object({
  commentId: z.number().int(),
  contentId: z.number().int(),
  authorUserId: z.string().nullish(),
  parentCommentId: z.number().int().nullish(),
  reviewThreadId: z.number().int().nullish(),
  bodyMarkdown: z.string().nullish(),
  status: z.string(),
  createTime: BackendDateTimeSchema,
  version: z.number().int(),
  author: PersonRefSchema.nullish(),
  revisionId: z.number().int().nullish(),
  isDeleted: z.boolean(),
  capabilities: z.record(z.string(), z.boolean()).nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type CommentView = z.infer<typeof CommentViewSchema>;

export const BookmarkViewSchema = z.object({
  contentId: z.number().int(),
  saved: z.boolean(),
});
export type BookmarkView = z.infer<typeof BookmarkViewSchema>;

export const SubscriptionViewSchema = z.object({
  subscriptionId: z.number().int(),
  userId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  targetLabel: z.string().nullish(),
  deliveryMode: z.string(),
  version: z.number().int().nullish(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type SubscriptionView = z.infer<typeof SubscriptionViewSchema>;

// ---- Moderation views ------------------------------------------------------------------------

export const ReportTargetSchema = z.object({
  kind: ReportTargetKindSchema,
  /** The content to open: for a comment, its parent content. */
  contentId: z.number().int(),
  title: z.string().nullish(),
});
export type ReportTarget = z.infer<typeof ReportTargetSchema>;

export const ReportCardSchema = z.object({
  reportId: z.number().int(),
  reasonCode: z.string(),
  status: z.string(),
  reportedAt: BackendDateTimeSchema.nullish(),
  assignedModerator: PersonRefSchema.nullish(),
  version: z.number().int(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
  target: ReportTargetSchema.nullish(),
});
export type ReportCard = z.infer<typeof ReportCardSchema>;

export const ActionSummarySchema = z.object({
  actionId: z.number().int(),
  actionType: z.string(),
  reason: z.string().nullish(),
  actor: PersonRefSchema.nullish(),
  occurredAt: BackendDateTimeSchema.nullish(),
});
export type ActionSummary = z.infer<typeof ActionSummarySchema>;

export const ReportCapabilitiesSchema = z.object({
  canAssign: z.boolean(),
  canReadEvidence: z.boolean(),
  canAct: z.boolean(),
});
export type ReportCapabilities = z.infer<typeof ReportCapabilitiesSchema>;

export const ReportViewSchema = ReportCardSchema.extend({
  targetType: z.string().nullish(),
  targetId: z.number().int().nullish(),
  /** Null unless the caller is the assigned moderator. */
  description: z.string().nullish(),
  reporter: PersonRefSchema.nullish(),
  actions: z.array(ActionSummarySchema).nullish(),
  capabilities: ReportCapabilitiesSchema.nullish(),
});
export type ReportView = z.infer<typeof ReportViewSchema>;

export const CommentEvidenceSchema = z.object({
  commentId: z.number().int(),
  contentId: z.number().int(),
  revisionId: z.number().int().nullish(),
  bodyMarkdown: z.string().nullish(),
  status: z.string(),
  deletedAt: BackendDateTimeSchema.nullish(),
});
export type CommentEvidence = z.infer<typeof CommentEvidenceSchema>;

export const EvidenceViewSchema = z.object({
  reportId: z.number().int(),
  targetType: z.string(),
  targetId: z.number().int(),
  targetVersion: z.number().int(),
  content: RevisionDetailSchema.nullish(),
  comment: CommentEvidenceSchema.nullish(),
  revisionId: z.number().int().nullish(),
  actions: z.array(ActionSummarySchema).nullish(),
});
export type EvidenceView = z.infer<typeof EvidenceViewSchema>;

export const ModeratorViewSchema = z.object({
  moderatorId: z.number().int(),
  userId: z.string(),
  orgId: z.number().int(),
  status: z.string(),
  /** Send it as `expectedVersion` with the next grant or revoke. */
  version: z.number().int(),
  user: PersonRefSchema.nullish(),
  grantedBy: PersonRefSchema.nullish(),
  grantedAt: BackendDateTimeSchema.nullish(),
  revokedAt: BackendDateTimeSchema.nullish(),
  createTime: BackendDateTimeSchema.nullish(),
  updateTime: BackendDateTimeSchema.nullish(),
});
export type ModeratorView = z.infer<typeof ModeratorViewSchema>;

// ---- Queries ---------------------------------------------------------------------------------

const tagIdsQuery = z
  .array(z.number().int().positive())
  .max(COMMUNITY_LIMITS.tags.max);

export const QuestionListQuerySchema = PageQuerySchema.extend({
  q: z.string().max(300).optional(),
  tagIds: tagIdsQuery.optional(),
  resolutionStatus: ResolutionStatusSchema.optional(),
});
export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

export const QuestionSuggestionQuerySchema = z.object({
  q: z
    .string()
    .min(COMMUNITY_LIMITS.suggestionQuery.min)
    .max(COMMUNITY_LIMITS.suggestionQuery.max),
  limit: z.number().int().min(1).max(10).optional(),
});

export const ArticleListQuerySchema = PageQuerySchema.extend({
  q: z.string().max(300).optional(),
  tagIds: tagIdsQuery.optional(),
  resolutionStatus: ResolutionStatusSchema.optional(),
});
export type ArticleListQuery = z.infer<typeof ArticleListQuerySchema>;

export const LessonListQuerySchema = ArticleListQuerySchema.extend({
  guildId: z.number().int().positive().optional(),
});
export type LessonListQuery = z.infer<typeof LessonListQuerySchema>;

export const MyContentsQuerySchema = PageQuerySchema.extend({
  kind: z.string().optional(),
  publicationState: z.string().optional(),
  lifecycleStatus: z.string().optional(),
});
export type MyContentsQuery = z.infer<typeof MyContentsQuerySchema>;

export const IncludeOwnDraftQuerySchema = z.object({
  includeOwnDraft: z.boolean().optional(),
});

export const TagListQuerySchema = PageQuerySchema.extend({
  q: z.string().max(100).optional(),
});
export type TagListQuery = z.infer<typeof TagListQuerySchema>;

export const ReportListQuerySchema = PageQuerySchema.extend({
  status: CommunityReportStatusSchema.optional(),
  assignedToMe: z.boolean().optional(),
});
export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;

export const ModeratorListQuerySchema = PageQuerySchema.extend({
  orgId: z.number().int().positive(),
  status: ModeratorStatusSchema.optional(),
});
export type ModeratorListQuery = z.infer<typeof ModeratorListQuerySchema>;

export const ModeratorCandidateQuerySchema = PageQuerySchema.extend({
  orgId: z.number().int().positive(),
  q: z.string().max(100).optional(),
});
export type ModeratorCandidateQuery = z.infer<
  typeof ModeratorCandidateQuerySchema
>;

// ---- Commands (strict: an extra key is a bug, and the server refuses it) ----------------------

const tagIdsInput = z
  .array(z.number().int().positive())
  .max(COMMUNITY_LIMITS.tags.max);

export const AssetInputSchema = z.strictObject({
  assetId: z.number().int().positive(),
  usage: z.enum([
    'inline',
    'attachment',
    'cover',
    'review_artifact',
    'primary_video',
    'inline_image',
    'design_file',
  ]),
  caption: z.string().max(5_000).optional(),
  altText: z.string().max(255).optional(),
  sortNo: z.number().int().min(0),
});
export type AssetInput = z.infer<typeof AssetInputSchema>;

export const ContentContextInputSchema = z.strictObject({
  review: z
    .strictObject({
      problem: z.string().max(10_000),
      constraints: z.string().max(20_000).optional(),
      decisionsNeeded: z.array(z.string().max(3_000)).max(20),
    })
    .optional(),
  technologies: z
    .array(
      z.strictObject({
        name: z.string().max(100),
        version: z.string().max(100).optional(),
      }),
    )
    .max(COMMUNITY_LIMITS.technologies.max)
    .optional(),
  environment: z.string().max(255).optional(),
  limitations: z.string().max(5_000).optional(),
  lessonLearned: z
    .strictObject({
      occurredOn: z.iso.date().optional(),
      symptoms: z.string().max(COMMUNITY_LIMITS.lesson.symptoms.max),
      rootCause: z.string().max(COMMUNITY_LIMITS.lesson.rootCause.max),
      resolution: z.string().max(COMMUNITY_LIMITS.lesson.resolution.max),
      prevention: z.string().max(COMMUNITY_LIMITS.lesson.prevention.max),
    })
    .optional(),
});
export type ContentContextInput = z.infer<typeof ContentContextInputSchema>;

const draftFields = {
  title: z.string().max(COMMUNITY_LIMITS.title.max),
  /** A draft may be empty; publishing needs 20 characters (`PublishableContentSchema`). */
  bodyMarkdown: z.string().max(COMMUNITY_LIMITS.body.max),
  summary: z.string().max(COMMUNITY_LIMITS.summary.max).optional(),
  context: ContentContextInputSchema.optional(),
  assets: z.array(AssetInputSchema).max(COMMUNITY_LIMITS.assets.max).optional(),
};

/** Creates a question, article or lesson learned as a draft. `clientRequestId` makes a retry safe. */
export const CreateContentCommandSchema = z.strictObject({
  clientRequestId: z.uuid(),
  ...draftFields,
  visibility: VisibilitySchema.optional(),
  primaryGuildId: z.number().int().positive().optional(),
  tagIds: tagIdsInput.optional(),
});
export type CreateContentCommand = z.infer<typeof CreateContentCommandSchema>;

/** An answer inherits visibility and tags from its question. */
export const CreateAnswerCommandSchema = z.strictObject({
  clientRequestId: z.uuid(),
  ...draftFields,
});
export type CreateAnswerCommand = z.infer<typeof CreateAnswerCommandSchema>;

export const SaveContentDraftCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
  expectedRevisionVersion: z.number().int().min(0),
  ...draftFields,
  /** Shown in the revision history. */
  changeNote: z.string().max(COMMUNITY_LIMITS.changeNote.max).optional(),
});
export type SaveContentDraftCommand = z.infer<
  typeof SaveContentDraftCommandSchema
>;

export const OpenDraftCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
});
export type OpenDraftCommand = z.infer<typeof OpenDraftCommandSchema>;

export const PublishCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
  expectedRevisionVersion: z.number().int().min(0),
});
export type PublishCommand = z.infer<typeof PublishCommandSchema>;

/**
 * The rules the server applies at publish. `NOT_PUBLISHABLE` carries no per-field errors, so the
 * forms check these before they enable "Đăng".
 */
export const PublishableContentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(COMMUNITY_LIMITS.title.min)
    .max(COMMUNITY_LIMITS.title.max),
  bodyMarkdown: z
    .string()
    .trim()
    .min(COMMUNITY_LIMITS.body.min)
    .max(COMMUNITY_LIMITS.body.max),
  tagIds: tagIdsInput,
});

/** A question also needs at least one tag. */
export const PublishableQuestionSchema = PublishableContentSchema.extend({
  tagIds: tagIdsInput.min(1),
});

export const PublishableLessonSchema = PublishableContentSchema.extend({
  lessonLearned: z.object({
    symptoms: z.string().trim().min(COMMUNITY_LIMITS.lesson.symptoms.min),
    rootCause: z.string().trim().min(COMMUNITY_LIMITS.lesson.rootCause.min),
    resolution: z.string().trim().min(COMMUNITY_LIMITS.lesson.resolution.min),
    prevention: z.string().trim().min(COMMUNITY_LIMITS.lesson.prevention.min),
  }),
});

export const AcceptCommandSchema = z
  .strictObject({
    expectedContentVersion: z.number().int().min(0),
    answerContentId: z.number().int().positive().nullable(),
    answerRevisionId: z.number().int().positive().nullable(),
  })
  .refine(
    (v) => (v.answerContentId === null) === (v.answerRevisionId === null),
    {
      message: 'answerContentId and answerRevisionId are both set or both null',
    },
  );
export type AcceptCommand = z.infer<typeof AcceptCommandSchema>;

export const LifecycleCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
  action: LifecycleActionSchema,
  reason: z
    .string()
    .min(COMMUNITY_LIMITS.reason.min)
    .max(COMMUNITY_LIMITS.reason.max),
});
export type LifecycleCommand = z.infer<typeof LifecycleCommandSchema>;

export const TagsCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
  tagIds: tagIdsInput,
});
export type TagsCommand = z.infer<typeof TagsCommandSchema>;

export const VoteCommandSchema = z.strictObject({
  value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
});
export type VoteCommand = z.infer<typeof VoteCommandSchema>;

export const CreateCommentCommandSchema = z.strictObject({
  clientRequestId: z.uuid(),
  parentCommentId: z.number().int().positive().optional(),
  bodyMarkdown: z.string().min(1).max(COMMUNITY_LIMITS.comment.max),
});
export type CreateCommentCommand = z.infer<typeof CreateCommentCommandSchema>;

export const UpdateCommentCommandSchema = z.strictObject({
  expectedVersion: z.number().int().min(0),
  bodyMarkdown: z.string().min(1).max(COMMUNITY_LIMITS.comment.max),
});
export type UpdateCommentCommand = z.infer<typeof UpdateCommentCommandSchema>;

export const SetBookmarkCommandSchema = z.strictObject({ saved: z.boolean() });
export type SetBookmarkCommand = z.infer<typeof SetBookmarkCommandSchema>;

/** Follows one content (the only target this app uses); `off` stops following. */
export const SubscriptionCommandSchema = z.strictObject({
  contentId: z.number().int().positive(),
  mode: SubscriptionModeSchema,
});
export type SubscriptionCommand = z.infer<typeof SubscriptionCommandSchema>;

/** Marks a question a duplicate of another; `targetQuestionId: null` clears the mark. */
export const DuplicateCommandSchema = z.strictObject({
  expectedContentVersion: z.number().int().min(0),
  targetQuestionId: z.number().int().positive().nullable(),
  reason: z
    .string()
    .min(COMMUNITY_LIMITS.reason.min)
    .max(COMMUNITY_LIMITS.reason.max),
  reportId: z.number().int().positive().optional(),
});
export type DuplicateCommand = z.infer<typeof DuplicateCommandSchema>;

/** Exactly one of `contentId` / `commentId`. */
export const CreateReportCommandSchema = z
  .strictObject({
    contentId: z.number().int().positive().optional(),
    commentId: z.number().int().positive().optional(),
    reasonCode: z.string().min(1).max(COMMUNITY_LIMITS.reasonCode.max),
    description: z
      .string()
      .max(COMMUNITY_LIMITS.reportDescription.max)
      .optional(),
  })
  .refine((v) => (v.contentId === undefined) !== (v.commentId === undefined), {
    message: 'Report exactly one of contentId or commentId',
  });
export type CreateReportCommand = z.infer<typeof CreateReportCommandSchema>;

export const AssignReportCommandSchema = z.strictObject({
  expectedVersion: z.number().int().min(0),
  moderatorUserId: z.string().min(1).max(20),
});
export type AssignReportCommand = z.infer<typeof AssignReportCommandSchema>;

export const ModerationActionCommandSchema = z.strictObject({
  expectedReportVersion: z.number().int().min(0),
  expectedTargetVersion: z.number().int().min(0),
  action: ModerationActionSchema,
  reason: z
    .string()
    .min(COMMUNITY_LIMITS.reason.min)
    .max(COMMUNITY_LIMITS.reason.max),
  maintainerUserId: z.string().max(20).optional(),
  restoreActionId: z.number().int().positive().optional(),
});
export type ModerationActionCommand = z.infer<
  typeof ModerationActionCommandSchema
>;

export const ModeratorCommandSchema = z.strictObject({
  orgId: z.number().int().positive(),
  active: z.boolean(),
  reason: z
    .string()
    .min(COMMUNITY_LIMITS.reason.min)
    .max(COMMUNITY_LIMITS.reason.max),
  /** The grant's `version`; 0 when the person has none yet. */
  expectedVersion: z.number().int().min(0),
});
export type ModeratorCommand = z.infer<typeof ModeratorCommandSchema>;
