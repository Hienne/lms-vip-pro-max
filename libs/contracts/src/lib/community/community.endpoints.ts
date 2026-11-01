import { z } from 'zod';
import { defineEndpoint } from '../http/endpoint';
import { PageQuerySchema, PageSchema } from '../http/page';
import {
  AcceptCommandSchema,
  ArticleListQuerySchema,
  AssignReportCommandSchema,
  SetBookmarkCommandSchema,
  BookmarkViewSchema,
  CommentViewSchema,
  ContentCardSchema,
  ContentDetailSchema,
  CreateAnswerCommandSchema,
  CreateCommentCommandSchema,
  CreateContentCommandSchema,
  CreateReportCommandSchema,
  DuplicateCommandSchema,
  EvidenceViewSchema,
  IncludeOwnDraftQuerySchema,
  LessonListQuerySchema,
  LifecycleCommandSchema,
  ModerationActionCommandSchema,
  ModeratorCandidateQuerySchema,
  ModeratorCommandSchema,
  ModeratorListQuerySchema,
  ModeratorViewSchema,
  MyContentsQuerySchema,
  OpenDraftCommandSchema,
  PersonRefSchema,
  PublishCommandSchema,
  QuestionListQuerySchema,
  QuestionSuggestionQuerySchema,
  ReportCardSchema,
  ReportListQuerySchema,
  ReportViewSchema,
  RevisionDetailSchema,
  SaveContentDraftCommandSchema,
  SubscriptionCommandSchema,
  SubscriptionViewSchema,
  TagListQuerySchema,
  TagViewSchema,
  TagsCommandSchema,
  UpdateCommentCommandSchema,
  VoteCommandSchema,
  VoteViewSchema,
} from './community.schema';

const id = (name: string) => z.object({ [name]: z.number().int().positive() });
const questionParams = id('questionId');
const contentParams = id('contentId');
const reportParams = id('reportId');

/**
 * The backend's community endpoints (/api/v1/community), keyed by what the screen does; the
 * comment names the contract id (C01...) of `docs/api/COMMUNITY.md`. There is no mockup `api/*.js`
 * for them: `docs/mockups/community/` is the spec. Every one is a plain backend endpoint.
 */
export const communityEndpoints = {
  // ---- Questions and answers ---------------------------------------------------------------
  /** C01: published questions the caller may read. */
  questions: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/questions',
    query: QuestionListQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C02: published questions that look like the title being typed (5..300 characters). */
  questionSuggestions: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/questions/suggestions',
    query: QuestionSuggestionQuerySchema,
    response: z.array(ContentCardSchema),
  }),
  /** C03: a question draft; publish it with `publishContent`. */
  createQuestion: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/questions',
    body: CreateContentCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C04: a question with its published revision, and the caller's draft with `includeOwnDraft`. */
  question: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/questions/{questionId}',
    params: questionParams,
    query: IncludeOwnDraftQuerySchema,
    response: ContentDetailSchema,
  }),
  /** C05: the answers of a question, the accepted one first, then by score. */
  answers: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/questions/{questionId}/answers',
    params: questionParams,
    query: PageQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C06: an answer draft; publish it with `publishContent`. */
  createAnswer: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/questions/{questionId}/answers',
    params: questionParams,
    body: CreateAnswerCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C07: accepts an answer, or clears the acceptance when both ids are null. */
  acceptAnswer: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/questions/{questionId}/accepted-answer',
    params: questionParams,
    body: AcceptCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C136: marks a question a duplicate of another, or clears the mark with a null target. */
  markDuplicate: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/questions/{questionId}/duplicate',
    params: questionParams,
    body: DuplicateCommandSchema,
    response: ContentDetailSchema,
  }),

  // ---- Articles and lessons learned --------------------------------------------------------
  /** C08: published articles. */
  articles: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/articles',
    query: ArticleListQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C09: an article draft. */
  createArticle: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/articles',
    body: CreateContentCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C93: published lessons learned, in the order the server gives (no sort). */
  lessons: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/lessons-learned',
    query: LessonListQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C94: a lesson-learned draft; its structured fields go in `context.lessonLearned`. */
  createLesson: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/lessons-learned',
    body: CreateContentCommandSchema,
    response: ContentDetailSchema,
  }),

  // ---- Any content -------------------------------------------------------------------------
  /** C10: a content of any kind; the page lays itself out by `kind`. */
  content: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/contents/{contentId}',
    params: contentParams,
    query: IncludeOwnDraftQuerySchema,
    response: ContentDetailSchema,
  }),
  /** C11: the caller's own contents, drafts included. */
  myContents: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/me/contents',
    query: MyContentsQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C12: the content's current draft, or a new one cloned from the published revision. */
  openDraft: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/draft',
    params: contentParams,
    body: OpenDraftCommandSchema,
    response: RevisionDetailSchema,
  }),
  /** C13: replaces the draft; a stale version is `COMMUNITY-CONFLICT`, never retried. */
  saveDraft: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/contents/{contentId}/draft',
    params: contentParams,
    body: SaveContentDraftCommandSchema,
    response: RevisionDetailSchema,
  }),
  /** C14: publishes the draft; `COMMUNITY-NOT_PUBLISHABLE` when title, body or tags fall short. */
  publishContent: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/publish',
    params: contentParams,
    body: PublishCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C15: the revisions the caller may read, newest first. */
  revisions: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/contents/{contentId}/revisions',
    params: contentParams,
    query: PageQuerySchema,
    response: PageSchema(RevisionDetailSchema),
  }),
  /** C16: one revision. */
  revision: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/contents/{contentId}/revisions/{revisionId}',
    params: z.object({
      contentId: z.number().int().positive(),
      revisionId: z.number().int().positive(),
    }),
    response: RevisionDetailSchema,
  }),
  /** C17: close, reopen, archive, unarchive or soft-delete, with a reason. */
  changeLifecycle: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/lifecycle',
    params: contentParams,
    body: LifecycleCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C19: replaces the content's tags (1..10 for a question). */
  setTags: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/contents/{contentId}/tags',
    params: contentParams,
    body: TagsCommandSchema,
    response: ContentDetailSchema,
  }),
  /** C20: sets the caller's vote (-1, 0, 1); the totals come back. */
  vote: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/contents/{contentId}/vote',
    params: contentParams,
    body: VoteCommandSchema,
    response: VoteViewSchema,
  }),
  /** C122: counts a view (once per user, content and day); nothing to render. */
  recordView: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/view',
    params: contentParams,
    response: z.null(),
  }),
  /** C21: the tag catalogue of the caller's organisation. */
  tags: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/tags',
    query: TagListQuerySchema,
    response: PageSchema(TagViewSchema),
  }),

  // ---- Comments ----------------------------------------------------------------------------
  /** C25: the comments of a content, flat; the thread comes from `parentCommentId`. */
  comments: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/contents/{contentId}/comments',
    params: contentParams,
    query: PageQuerySchema.extend({
      reviewThreadId: z.number().int().positive().optional(),
    }),
    response: PageSchema(CommentViewSchema),
  }),
  /** C26: posts a comment (up to three levels deep). */
  createComment: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/contents/{contentId}/comments',
    params: contentParams,
    body: CreateCommentCommandSchema,
    response: CommentViewSchema,
  }),
  /** C27: edits the caller's own comment. */
  updateComment: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/comments/{commentId}',
    params: id('commentId'),
    body: UpdateCommentCommandSchema,
    response: CommentViewSchema,
  }),
  /** C28: soft-deletes the caller's own comment. */
  deleteComment: defineEndpoint({
    method: 'delete',
    path: '/api/v1/community/comments/{commentId}',
    params: id('commentId'),
    query: z.object({ expectedVersion: z.number().int().min(0) }),
    response: z.null(),
  }),

  // ---- Saved and followed ------------------------------------------------------------------
  /** C29: the caller's bookmarks. */
  bookmarks: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/me/bookmarks',
    query: PageQuerySchema,
    response: PageSchema(ContentCardSchema),
  }),
  /** C30: saves or unsaves a content. */
  setBookmark: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/me/bookmarks/{contentId}',
    params: contentParams,
    body: SetBookmarkCommandSchema,
    response: BookmarkViewSchema,
  }),
  /** C32: follows a content in a mode; `off` stops following and answers null. */
  setSubscription: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/me/subscriptions',
    body: SubscriptionCommandSchema,
    response: SubscriptionViewSchema.nullable(),
  }),

  // ---- Reports and moderation --------------------------------------------------------------
  /** C37: reports a content or a comment. */
  createReport: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/reports',
    body: CreateReportCommandSchema,
    response: ReportViewSchema,
  }),
  /** C38: the report queue of the moderator's organisation. Refused (403) for a non-moderator. */
  reports: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/moderation/reports',
    query: ReportListQuerySchema,
    response: PageSchema(ReportCardSchema),
  }),
  /** C139: one report; description, reporter and history only for the assigned moderator. */
  report: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/moderation/reports/{reportId}',
    params: reportParams,
    response: ReportViewSchema,
  }),
  /** C39: assigns a moderator ("Nhận xử lý" assigns the caller). */
  assignReport: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/moderation/reports/{reportId}/assign',
    params: reportParams,
    body: AssignReportCommandSchema,
    response: ReportViewSchema,
  }),
  /** C40: the reported content as it was; only the assigned moderator, and it is audited. */
  reportEvidence: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/moderation/reports/{reportId}/evidence',
    params: reportParams,
    response: EvidenceViewSchema,
  }),
  /** C41: acts on a report (hide, restore, close, warn, dismiss...) with a reason. */
  actOnReport: defineEndpoint({
    method: 'post',
    path: '/api/v1/community/moderation/reports/{reportId}/actions',
    params: reportParams,
    body: ModerationActionCommandSchema,
    response: ReportViewSchema,
  }),
  /** C140: the organisation's moderators, newest grant first. */
  moderators: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/moderation/moderators',
    query: ModeratorListQuerySchema,
    response: PageSchema(ModeratorViewSchema),
  }),
  /** C42: grants or revokes the moderator role of a person; ADMIN in scope or SUPER_ADMIN. */
  setModerator: defineEndpoint({
    method: 'put',
    path: '/api/v1/community/moderation/moderators/{userId}',
    params: z.object({ userId: z.string().min(1).max(20) }),
    body: ModeratorCommandSchema,
    response: ModeratorViewSchema,
  }),
  /** C141: active staff of the organisation to pick from when appointing or assigning. */
  moderatorCandidates: defineEndpoint({
    method: 'get',
    path: '/api/v1/community/moderation/candidates',
    query: ModeratorCandidateQuerySchema,
    response: PageSchema(PersonRefSchema),
  }),
} as const;
