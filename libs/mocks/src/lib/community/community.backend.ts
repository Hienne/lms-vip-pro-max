import {
  AcceptCommandSchema,
  AssignReportCommandSchema,
  CreateAnswerCommandSchema,
  CreateCommentCommandSchema,
  CreateContentCommandSchema,
  CreateReportCommandSchema,
  DuplicateCommandSchema,
  LifecycleCommandSchema,
  ModerationActionCommandSchema,
  ModeratorCommandSchema,
  OpenDraftCommandSchema,
  PublishCommandSchema,
  PublishableContentSchema,
  PublishableQuestionSchema,
  SaveContentDraftCommandSchema,
  SetBookmarkCommandSchema,
  SubscriptionCommandSchema,
  TagsCommandSchema,
  UpdateCommentCommandSchema,
  VoteCommandSchema,
  communityEndpoints,
  type AnyEndpoint,
  type Capabilities,
  type ContentCard,
  type ContentContext,
  type ContentDetail,
  type ContentRef,
  type PersonRef,
  type RevisionDetail,
  type AssetInput,
  type RevisionAssetView,
} from '@lms/contracts';
import type { z } from 'zod';
import type { FakeReply, FakeRequest } from '../backend/fake-backend';
import { LearningRefused, ok, refuse } from '../learning/learning-reply';
import {
  COMMUNITY_MODERATOR_USER_ID,
  COMMUNITY_ORG_ID,
  communityCommentFixtures,
  communityContentFixtures,
  communityReportFixtures,
  communityTagFixtures,
  communityVoteFixtures,
} from './community.fixtures';

/** What the community service asks the identity service. */
export interface CommunityDirectory {
  /** The caller's staff code; refuses (401, 403) like the identity service does. */
  callerId(request: FakeRequest): string;
  orgOf(userId: string): number | null;
  nameOf(userId: string): string | undefined;
  /** ADMIN or SUPER_ADMIN by role (they appoint moderators, they are not moderators). */
  isAdmin(userId: string): boolean;
  /** Active people of an org, to pick a moderator from. */
  activePeople(orgId: number): readonly PersonRef[];
}

type Handler = (request: FakeRequest) => FakeReply;
type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface Revision {
  assets?: RevisionAssetView[];
  revisionId: number;
  revisionNo: number;
  title: string;
  bodyMarkdown: string;
  summary: string | null;
  context: ContentContext | null;
  status: 'draft' | 'published' | 'superseded';
  publishedAt: string | null;
  revisionVersion: number;
  changeNote: string | null;
  editorUserId: string;
  updateTime: string;
}

/**
 * How the question was closed. A moderator closing it through a report case is `moderated`, with
 * no reason or actor: readers do not see who handled the case or the wording written for it.
 */
interface Closure {
  action: 'close' | 'duplicate' | 'archive' | 'moderated';
  reason: string | null;
  actorUserId: string | null;
  occurredAt: string;
}

interface Doc {
  contentId: number;
  kind: string;
  authorUserId: string;
  questionId: number | null;
  lifecycle: 'active' | 'closed' | 'archived' | 'hidden' | 'deleted';
  version: number;
  tagIds: number[];
  revisions: Revision[];
  acceptedAnswerId: number | null;
  acceptedRevisionId: number | null;
  duplicateOf: number | null;
  closure: Closure | null;
  lastActivityAt: string;
  createdAt: string;
  clientRequestId: string | null;
}

interface Comment {
  commentId: number;
  contentId: number;
  authorUserId: string;
  parentCommentId: number | null;
  bodyMarkdown: string;
  status: 'visible' | 'hidden' | 'deleted';
  createTime: string;
  updateTime: string;
  version: number;
  clientRequestId: string | null;
}

interface Action {
  actionId: number;
  actionType: string;
  reason: string;
  actorUserId: string;
  occurredAt: string;
}

interface Report {
  reportId: number;
  contentId: number | null;
  commentId: number | null;
  reasonCode: string;
  description: string | null;
  reporterUserId: string;
  reportedAt: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  assignedUserId: string | null;
  version: number;
  actions: Action[];
}

interface Moderator {
  moderatorId: number;
  userId: string;
  orgId: number;
  status: 'active' | 'revoked';
  version: number;
  grantedByUserId: string;
  grantedAt: string;
  revokedAt: string | null;
}

const now = () => new Date().toISOString();
const num = (value: string | undefined): number | undefined =>
  value === undefined || value === '' ? undefined : Number(value);

function paged<T>(rows: readonly T[], query: Readonly<Record<string, string>>) {
  const page = num(query['page']) ?? 0;
  const size = num(query['size']) ?? 20;
  return {
    items: rows.slice(page * size, page * size + size),
    page,
    size,
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / size),
  };
}

const DEMO_CLOSED_QUESTION = 107;

/**
 * The backend's community service in memory: questions, answers, articles and lessons learned with
 * draft/publish revisions and versions, votes, comments, bookmarks, follows, reports and the
 * moderator roster. Like the server it computes the capabilities, the score, the answer count and
 * the resolution status itself; a stale version is `COMMUNITY-CONFLICT`. State lives for one page
 * load.
 */
export class CommunityBackend {
  private nextId = 1000;
  private readonly tags = communityTagFixtures.map((t) => ({
    ...t,
    version: 0,
  }));
  private readonly docs: Doc[] = [];
  private readonly comments: Comment[] = [];
  private readonly votes = new Map<string, 1 | -1>();
  private readonly bookmarks = new Set<string>();
  private readonly subscriptions = new Map<string, string>();
  private readonly reports: Report[] = [];
  private readonly moderators: Moderator[] = [];

  constructor(private readonly directory: CommunityDirectory) {
    for (const f of communityContentFixtures) {
      this.docs.push({
        contentId: f.contentId,
        kind: f.kind,
        authorUserId: f.authorUserId,
        questionId: f.questionId ?? null,
        lifecycle: 'active',
        version: 1,
        tagIds: [...(f.tagIds ?? [])],
        revisions: [
          {
            revisionId: f.contentId * 10,
            revisionNo: 1,
            title: f.title,
            bodyMarkdown: f.bodyMarkdown,
            summary: f.summary ?? null,
            context: (f.context as ContentContext | undefined) ?? null,
            status: 'published',
            publishedAt: f.publishedAt,
            revisionVersion: 1,
            changeNote: null,
            editorUserId: f.authorUserId,
            updateTime: f.publishedAt,
          },
        ],
        acceptedAnswerId: null,
        acceptedRevisionId: null,
        duplicateOf: null,
        closure: null,
        lastActivityAt: f.publishedAt,
        createdAt: f.publishedAt,
        clientRequestId: null,
      });
    }
    // 102 is the accepted answer of 101; 107 was closed by its author.
    const q101 = this.docs.find((d) => d.contentId === 101);
    if (q101) {
      q101.acceptedAnswerId = 102;
      q101.acceptedRevisionId = 1020;
    }
    const q107 = this.docs.find((d) => d.contentId === DEMO_CLOSED_QUESTION);
    if (q107) {
      q107.lifecycle = 'closed';
      q107.closure = {
        action: 'close',
        reason: 'Đã có quy ước chung trong tài liệu thiết kế.',
        actorUserId: q107.authorUserId,
        occurredAt: '2026-10-25T02:00:00Z',
      };
    }
    for (const c of communityCommentFixtures) {
      this.comments.push({
        commentId: c.commentId,
        contentId: c.contentId,
        authorUserId: c.authorUserId,
        parentCommentId: c.parentCommentId ?? null,
        bodyMarkdown: c.bodyMarkdown,
        status: 'visible',
        createTime: c.createTime,
        updateTime: c.createTime,
        version: 0,
        clientRequestId: null,
      });
    }
    for (const v of communityVoteFixtures) {
      this.votes.set(`${v.contentId}:${v.userId}`, v.value);
    }
    for (const r of communityReportFixtures) {
      this.reports.push({
        reportId: r.reportId,
        contentId: r.contentId ?? null,
        commentId: r.commentId ?? null,
        reasonCode: r.reasonCode,
        description: r.description,
        reporterUserId: r.reporterUserId,
        reportedAt: r.reportedAt,
        status: 'open',
        assignedUserId: null,
        version: 0,
        actions: [],
      });
    }
    this.moderators.push({
      moderatorId: 1,
      userId: COMMUNITY_MODERATOR_USER_ID,
      orgId: COMMUNITY_ORG_ID,
      status: 'active',
      version: 1,
      grantedByUserId: '000002',
      grantedAt: '2026-10-19T02:00:00Z',
      revokedAt: null,
    });
  }

  /** True for an active moderator of the org: the identity service adds the moderation menu to `/me`. */
  isModerator(userId: string, orgId: number | null): boolean {
    return this.moderators.some(
      (m) => m.userId === userId && m.orgId === orgId && m.status === 'active',
    );
  }

  /** True for the endpoints this service answers. */
  answers(endpoint: AnyEndpoint): boolean {
    return Object.values(communityEndpoints).some((e) => e === endpoint);
  }

  entries(): [AnyEndpoint, Handler][] {
    const e = communityEndpoints;
    const table: [AnyEndpoint, Handler][] = [
      [e.questions, (r) => this.list(r, ['question'])],
      [e.questionSuggestions, (r) => this.suggestions(r)],
      [e.createQuestion, (r) => this.create(r, 'question')],
      [e.question, (r) => this.detail(r, 'questionId')],
      [e.answers, (r) => this.answersOf(r)],
      [e.createAnswer, (r) => this.createAnswer(r)],
      [e.acceptAnswer, (r) => this.accept(r)],
      [e.markDuplicate, (r) => this.markDuplicate(r)],
      [e.articles, (r) => this.list(r, ['article'])],
      [e.createArticle, (r) => this.create(r, 'article')],
      [e.lessons, (r) => this.list(r, ['lesson_learned'])],
      [e.createLesson, (r) => this.create(r, 'lesson_learned')],
      [e.content, (r) => this.detail(r, 'contentId')],
      [e.myContents, (r) => this.mine(r)],
      [e.openDraft, (r) => this.openDraft(r)],
      [e.saveDraft, (r) => this.saveDraft(r)],
      [e.publishContent, (r) => this.publish(r)],
      [e.revisions, (r) => this.history(r)],
      [e.revision, (r) => this.oneRevision(r)],
      [e.changeLifecycle, (r) => this.lifecycle(r)],
      [e.setTags, (r) => this.setTags(r)],
      [e.vote, (r) => this.vote(r)],
      [e.recordView, (r) => this.recordView(r)],
      [e.tags, (r) => this.tagList(r)],
      [e.comments, (r) => this.commentList(r)],
      [e.createComment, (r) => this.createComment(r)],
      [e.updateComment, (r) => this.updateComment(r)],
      [e.deleteComment, (r) => this.deleteComment(r)],
      [e.bookmarks, (r) => this.bookmarkList(r)],
      [e.setBookmark, (r) => this.setBookmark(r)],
      [e.setSubscription, (r) => this.setSubscription(r)],
      [e.createReport, (r) => this.createReport(r)],
      [e.reports, (r) => this.reportList(r)],
      [e.report, (r) => this.reportOne(r)],
      [e.assignReport, (r) => this.assignReport(r)],
      [e.reportEvidence, (r) => this.evidence(r)],
      [e.actOnReport, (r) => this.actOnReport(r)],
      [e.moderators, (r) => this.moderatorList(r)],
      [e.setModerator, (r) => this.setModerator(r)],
      [e.moderatorCandidates, (r) => this.candidates(r)],
    ];
    return table.map(([endpoint, handler]) => [
      endpoint,
      (request) => {
        try {
          return handler(request);
        } catch (error) {
          if (error instanceof LearningRefused) return error.reply;
          throw error;
        }
      },
    ]);
  }

  // ---- helpers ------------------------------------------------------------------------------

  private id(): number {
    return this.nextId++;
  }

  private body<S extends z.ZodType>(
    schema: S,
    request: FakeRequest,
  ): z.output<S> {
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return refuse('validationFailed');
    return parsed.data;
  }

  private person(userId: string): PersonRef {
    return { userId, displayName: this.directory.nameOf(userId) ?? userId };
  }

  private doc(contentId: number | undefined): Doc {
    const doc = this.docs.find((d) => d.contentId === contentId);
    if (!doc || doc.lifecycle === 'hidden' || doc.lifecycle === 'deleted') {
      return refuse('communityNotFound');
    }
    return doc;
  }

  private stale(expected: number, actual: number): void {
    if (expected !== actual) refuse('communityConflict');
  }

  private published(doc: Doc): Revision | undefined {
    return doc.revisions.find((r) => r.status === 'published');
  }

  private draftOf(doc: Doc): Revision | undefined {
    return doc.revisions.find((r) => r.status === 'draft');
  }

  private isOwner(doc: Doc, userId: string): boolean {
    return doc.authorUserId === userId;
  }

  private moderatorOf(userId: string): boolean {
    return this.isModerator(userId, this.directory.orgOf(userId));
  }

  /** A published, readable content: drafts are visible to their author only. */
  private readable(doc: Doc, userId: string): boolean {
    return !!this.published(doc) || this.isOwner(doc, userId);
  }

  private answersList(doc: Doc): Doc[] {
    return this.docs.filter(
      (d) =>
        d.questionId === doc.contentId &&
        d.kind === 'answer' &&
        d.lifecycle === 'active' &&
        this.published(d),
    );
  }

  private score(contentId: number): number {
    let total = 0;
    for (const [key, value] of this.votes) {
      if (key.startsWith(`${contentId}:`)) total += value;
    }
    return total;
  }

  private resolution(doc: Doc): string | null {
    if (doc.kind !== 'question') return null;
    if (doc.acceptedAnswerId !== null) return 'solved';
    return this.answersList(doc).length > 0 ? 'answered' : 'unanswered';
  }

  private tagViews(ids: readonly number[]) {
    return ids.flatMap((id) => {
      const tag = this.tags.find((t) => t.tagId === id);
      return tag
        ? [
            {
              tagId: tag.tagId,
              slug: tag.slug,
              name: tag.name,
              description: tag.description,
              status: 'active',
              aliases: [...tag.aliases],
              version: tag.version,
              usageCount: this.docs.filter((d) => d.tagIds.includes(id)).length,
            },
          ]
        : [];
    });
  }

  private ref(contentId: number): ContentRef | null {
    const doc = this.docs.find((d) => d.contentId === contentId);
    const revision = doc && this.published(doc);
    if (!doc || !revision) return null;
    return {
      contentId,
      kind: doc.kind,
      revisionId: revision.revisionId,
      title: revision.title,
      url: `/community/contents/${contentId}`,
    };
  }

  private capabilities(doc: Doc, userId: string, card: boolean): Capabilities {
    const owner = this.isOwner(doc, userId);
    const live = !!this.published(doc);
    const active = doc.lifecycle === 'active';
    const question = doc.kind === 'question';
    const othersAnswered = this.answersList(doc).some(
      (a) => a.authorUserId !== doc.authorUserId,
    );
    return {
      canEditDraft: owner && doc.lifecycle !== 'archived',
      canPublish: owner && !!this.draftOf(doc),
      canAnswer: question && active && live,
      canComment: active && live,
      canVote: active && live && !owner,
      canAccept:
        question && owner && (active || doc.lifecycle === 'closed') && live,
      canManageAccess: false,
      canReport: live && !owner,
      // The card never carries the lifecycle flags: the detail does.
      canClose: !card && question && owner && active && live,
      // The author or maintainer reopens, unless a moderator closed it through a report case.
      canReopen:
        !card &&
        question &&
        owner &&
        doc.lifecycle === 'closed' &&
        doc.closure?.action !== 'moderated',
      canArchive:
        !card && owner && (active || doc.lifecycle === 'closed') && live,
      canDelete: !card && owner && !othersAnswered && live,
      canMarkDuplicate: !card && question && owner && active && live,
    };
  }

  private revisionView(doc: Doc, revision: Revision): RevisionDetail {
    return {
      revisionId: revision.revisionId,
      contentId: doc.contentId,
      revisionNo: revision.revisionNo,
      title: revision.title,
      bodyMarkdown: revision.bodyMarkdown,
      summary: revision.summary,
      context: revision.context,
      revisionStatus: revision.status,
      publishedAt: revision.publishedAt,
      revisionVersion: revision.revisionVersion,
      contentVersion: doc.version,
      assets: revision.assets ?? [],
      changeNote: revision.changeNote,
      editor: this.person(revision.editorUserId),
      updateTime: revision.updateTime,
    };
  }

  private card(doc: Doc, userId: string): ContentCard {
    const revision =
      this.published(doc) ?? this.draftOf(doc) ?? doc.revisions[0];
    const lesson = revision.context?.lessonLearned;
    const target = doc.duplicateOf === null ? null : this.ref(doc.duplicateOf);
    return {
      contentId: doc.contentId,
      kind: doc.kind,
      title: revision.title,
      summary: revision.summary,
      authorUserId: doc.authorUserId,
      lifecycleStatus: doc.lifecycle,
      visibility: 'organization',
      primaryGuildId: null,
      publishedAt: this.published(doc)?.publishedAt ?? null,
      lastActivityAt: doc.lastActivityAt,
      contentVersion: doc.version,
      publishedRevisionId: this.published(doc)?.revisionId ?? null,
      author: this.person(doc.authorUserId),
      tags: this.tagViews(doc.tagIds),
      score: this.score(doc.contentId),
      myVote: this.votes.get(`${doc.contentId}:${userId}`) ?? 0,
      capabilities: this.capabilities(doc, userId, true),
      resolutionStatus: this.resolution(doc),
      answerCount: doc.kind === 'question' ? this.answersList(doc).length : 0,
      acceptedAnswerId: doc.acceptedAnswerId,
      isDuplicate: doc.duplicateOf !== null,
      duplicateTarget: target,
      questionId: doc.questionId,
      revisionId: revision.revisionId,
      isAccepted:
        doc.kind === 'answer' &&
        this.docs.some(
          (q) =>
            q.contentId === doc.questionId &&
            q.acceptedAnswerId === doc.contentId,
        ),
      acceptedRevisionId: doc.acceptedRevisionId,
      acceptedRevisionIsCurrent:
        doc.acceptedRevisionId !== null &&
        doc.acceptedRevisionId === this.published(doc)?.revisionId,
      hasDraft: !!this.draftOf(doc) && !!this.published(doc),
      occurredOn: lesson?.occurredOn ?? null,
      coverRevisionAssetId:
        revision.assets?.find((asset) => asset.usage === 'cover')
          ?.revisionAssetId ?? null,
    };
  }

  private detailOf(doc: Doc, userId: string): ContentDetail {
    const published = this.published(doc);
    const draft = this.draftOf(doc);
    const accepted =
      doc.acceptedRevisionId !== null &&
      doc.acceptedAnswerId !== null &&
      this.published(
        this.docs.find((d) => d.contentId === doc.acceptedAnswerId) ?? doc,
      )?.revisionId === doc.acceptedRevisionId;
    const subscription = this.subscriptions.get(`${doc.contentId}:${userId}`);
    return {
      contentId: doc.contentId,
      kind: doc.kind,
      ownerOrgId: COMMUNITY_ORG_ID,
      author: this.person(doc.authorUserId),
      maintainer: this.person(doc.authorUserId),
      lifecycleStatus: doc.lifecycle,
      visibility: 'organization',
      primaryGuildId: null,
      contentVersion: doc.version,
      publishedRevision: published ? this.revisionView(doc, published) : null,
      draftRevision:
        draft && this.isOwner(doc, userId)
          ? this.revisionView(doc, draft)
          : null,
      tags: this.tagViews(doc.tagIds),
      capabilities: this.capabilities(doc, userId, false),
      resolutionStatus: this.resolution(doc),
      acceptedAnswerId: doc.acceptedAnswerId,
      acceptedRevisionId: doc.acceptedRevisionId,
      acceptedRevisionIsCurrent: accepted,
      answerCount: doc.kind === 'question' ? this.answersList(doc).length : 0,
      score: this.score(doc.contentId),
      myVote: this.votes.get(`${doc.contentId}:${userId}`) ?? 0,
      saved: this.bookmarks.has(`${doc.contentId}:${userId}`),
      subscriptionMode:
        subscription === undefined
          ? null
          : (subscription as ContentDetail['subscriptionMode']),
      isDuplicate: doc.duplicateOf !== null,
      duplicateTarget:
        doc.duplicateOf === null ? null : this.ref(doc.duplicateOf),
      closure: doc.closure
        ? {
            action: doc.closure.action,
            reason: doc.closure.reason,
            actor:
              doc.closure.actorUserId === null
                ? null
                : this.person(doc.closure.actorUserId),
            occurredAt: doc.closure.occurredAt,
          }
        : null,
      questionId: doc.questionId,
    };
  }

  private touch(doc: Doc): void {
    doc.version += 1;
    doc.lastActivityAt = now();
  }

  // ---- lists --------------------------------------------------------------------------------

  private matches(doc: Doc, query: Readonly<Record<string, string>>): boolean {
    const revision = this.published(doc);
    if (!revision || doc.lifecycle === 'hidden' || doc.lifecycle === 'deleted')
      return false;
    const q = (query['q'] ?? '').trim().toLowerCase();
    if (
      q &&
      !`${revision.title} ${revision.bodyMarkdown}`.toLowerCase().includes(q)
    ) {
      return false;
    }
    const tagIds = (query['tagIds'] ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    if (tagIds.length > 0 && !tagIds.some((t) => doc.tagIds.includes(t)))
      return false;
    const resolution = query['resolutionStatus'];
    if (resolution && this.resolution(doc) !== resolution) return false;
    return true;
  }

  private list(request: FakeRequest, kinds: string[]): FakeReply {
    const userId = this.directory.callerId(request);
    const sort = request.query['sort'] ?? '';
    const rows = this.docs
      .filter((d) => kinds.includes(d.kind) && this.matches(d, request.query))
      .sort((a, b) => {
        if (sort.startsWith('score'))
          return this.score(b.contentId) - this.score(a.contentId);
        const key = kinds[0] === 'question' ? 'lastActivityAt' : 'createdAt';
        return b[key].localeCompare(a[key]) || b.contentId - a.contentId;
      });
    return ok(
      paged(
        rows.map((d) => this.card(d, userId)),
        request.query,
      ),
    );
  }

  private suggestions(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const q = (request.query['q'] ?? '').toLowerCase();
    if (q.length < 5) return refuse('validationFailed');
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const limit = num(request.query['limit']) ?? 5;
    const rows = this.docs
      .filter((d) => {
        const revision = this.published(d);
        if (d.kind !== 'question' || !revision || d.lifecycle !== 'active')
          return false;
        const text = revision.title.toLowerCase();
        return text.includes(q) || words.some((w) => text.includes(w));
      })
      .slice(0, limit);
    return ok(rows.map((d) => this.card(d, userId)));
  }

  private answersOf(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const question = this.doc(num(request.params['questionId']));
    const rows = this.answersList(question).sort(
      (a, b) =>
        Number(b.contentId === question.acceptedAnswerId) -
          Number(a.contentId === question.acceptedAnswerId) ||
        this.score(b.contentId) - this.score(a.contentId) ||
        a.createdAt.localeCompare(b.createdAt),
    );
    return ok(
      paged(
        rows.map((d) => this.card(d, userId)),
        request.query,
      ),
    );
  }

  private mine(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const { kind, publicationState, lifecycleStatus } = request.query;
    const rows = this.docs
      .filter((d) => d.authorUserId === userId && d.lifecycle !== 'deleted')
      .filter((d) => !kind || d.kind === kind)
      .filter((d) => !lifecycleStatus || d.lifecycle === lifecycleStatus)
      .filter((d) => {
        if (publicationState === 'published') return !!this.published(d);
        if (publicationState === 'draft') return !!this.draftOf(d);
        return true;
      })
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return ok(
      paged(
        rows.map((d) => this.card(d, userId)),
        request.query,
      ),
    );
  }

  private bookmarkList(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const rows = this.docs.filter(
      (d) =>
        this.bookmarks.has(`${d.contentId}:${userId}`) &&
        !!this.published(d) &&
        d.lifecycle !== 'hidden' &&
        d.lifecycle !== 'deleted',
    );
    return ok(
      paged(
        rows.map((d) => this.card(d, userId)),
        request.query,
      ),
    );
  }

  private tagList(request: FakeRequest): FakeReply {
    this.directory.callerId(request);
    const q = (request.query['q'] ?? '').toLowerCase();
    const rows = this.tags.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.aliases.some((a) => a.includes(q)),
    );
    return ok(
      paged(
        rows.flatMap((t) => this.tagViews([t.tagId])),
        request.query,
      ),
    );
  }

  // ---- content: read, create, draft, publish ----------------------------------------------

  private detail(request: FakeRequest, param: string): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params[param]));
    if (!this.readable(doc, userId)) return refuse('communityNotFound');
    if (param === 'questionId' && doc.kind !== 'question')
      return refuse('communityNotFound');
    return ok(this.detailOf(doc, userId));
  }

  private newDoc(
    userId: string,
    kind: string,
    questionId: number | null,
    body: {
      clientRequestId: string;
      title: string;
      bodyMarkdown: string;
      summary?: string;
      context?: ContentContext;
      assets?: AssetInput[];
    },
    tagIds: number[],
  ): Doc {
    const retried = this.docs.find(
      (d) =>
        d.authorUserId === userId && d.clientRequestId === body.clientRequestId,
    );
    if (retried) {
      const first = retried.revisions[0];
      if (
        first.title !== body.title ||
        first.bodyMarkdown !== body.bodyMarkdown
      ) {
        return refuse('communityIdempotencyConflict');
      }
      return retried;
    }
    if (tagIds.some((t) => !this.tags.some((tag) => tag.tagId === t))) {
      return refuse('communityInvalidReference');
    }
    const stamp = now();
    const doc: Doc = {
      contentId: this.id(),
      kind,
      authorUserId: userId,
      questionId,
      lifecycle: 'active',
      version: 0,
      tagIds,
      revisions: [
        {
          revisionId: this.id(),
          revisionNo: 1,
          title: body.title,
          bodyMarkdown: body.bodyMarkdown,
          summary: body.summary ?? null,
          context: body.context ?? null,
          assets: (body.assets ?? []).map((asset) => ({
            ...asset,
            revisionAssetId: this.id(),
          })),
          status: 'draft',
          publishedAt: null,
          revisionVersion: 0,
          changeNote: null,
          editorUserId: userId,
          updateTime: stamp,
        },
      ],
      acceptedAnswerId: null,
      acceptedRevisionId: null,
      duplicateOf: null,
      closure: null,
      lastActivityAt: stamp,
      createdAt: stamp,
      clientRequestId: body.clientRequestId,
    };
    this.docs.push(doc);
    return doc;
  }

  private create(request: FakeRequest, kind: string): FakeReply {
    const userId = this.directory.callerId(request);
    const body = this.body(CreateContentCommandSchema, request);
    const doc = this.newDoc(userId, kind, null, body, [...(body.tagIds ?? [])]);
    return ok(this.detailOf(doc, userId));
  }

  private createAnswer(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const question = this.doc(num(request.params['questionId']));
    if (question.kind !== 'question' || !this.published(question)) {
      return refuse('communityNotFound');
    }
    if (question.lifecycle !== 'active') return refuse('communityStateInvalid');
    const body = this.body(CreateAnswerCommandSchema, request);
    const doc = this.newDoc(userId, 'answer', question.contentId, body, []);
    return ok(this.detailOf(doc, userId));
  }

  /** A draft is only for its author; anyone else gets the same answer as for a missing content. */
  private editable(doc: Doc, userId: string): void {
    if (!this.isOwner(doc, userId)) refuse('communityNotFound');
    if (doc.lifecycle === 'archived') refuse('communityStateInvalid');
  }

  private openDraft(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    this.editable(doc, userId);
    const body = this.body(OpenDraftCommandSchema, request);
    const existing = this.draftOf(doc);
    if (existing) return ok(this.revisionView(doc, existing));
    this.stale(body.expectedContentVersion, doc.version);
    const base = this.published(doc);
    if (!base) return refuse('communityStateInvalid');
    const draft: Revision = {
      ...base,
      revisionId: this.id(),
      revisionNo: Math.max(...doc.revisions.map((r) => r.revisionNo)) + 1,
      status: 'draft',
      publishedAt: null,
      revisionVersion: 0,
      changeNote: null,
      editorUserId: userId,
      updateTime: now(),
    };
    doc.revisions.push(draft);
    return ok(this.revisionView(doc, draft));
  }

  private saveDraft(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    this.editable(doc, userId);
    const body = this.body(SaveContentDraftCommandSchema, request);
    const draft = this.draftOf(doc);
    if (!draft) return refuse('communityStateInvalid');
    this.stale(body.expectedContentVersion, doc.version);
    this.stale(body.expectedRevisionVersion, draft.revisionVersion);
    Object.assign<Mutable<Revision>, Partial<Revision>>(draft, {
      title: body.title,
      bodyMarkdown: body.bodyMarkdown,
      summary: body.summary ?? null,
      context: body.context ?? null,
      assets: (body.assets ?? []).map((asset) => ({
        ...asset,
        revisionAssetId: this.id(),
      })),
      changeNote: body.changeNote ?? null,
      editorUserId: userId,
      updateTime: now(),
      revisionVersion: draft.revisionVersion + 1,
    });
    this.touch(doc);
    return ok(this.revisionView(doc, draft));
  }

  private publish(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    this.editable(doc, userId);
    const body = this.body(PublishCommandSchema, request);
    const draft = this.draftOf(doc);
    if (!draft) return refuse('communityStateInvalid');
    this.stale(body.expectedContentVersion, doc.version);
    this.stale(body.expectedRevisionVersion, draft.revisionVersion);
    const rules =
      doc.kind === 'question'
        ? PublishableQuestionSchema
        : PublishableContentSchema;
    const lesson = draft.context?.lessonLearned;
    const lessonOk =
      doc.kind !== 'lesson_learned' ||
      [
        lesson?.symptoms,
        lesson?.rootCause,
        lesson?.resolution,
        lesson?.prevention,
      ].every((text) => (text ?? '').trim().length >= 20);
    if (
      !lessonOk ||
      !rules.safeParse({
        title: draft.title,
        bodyMarkdown: draft.bodyMarkdown,
        tagIds: doc.tagIds,
      }).success
    ) {
      return refuse('communityNotPublishable');
    }
    const previous = this.published(doc);
    if (previous) previous.status = 'superseded';
    draft.status = 'published';
    draft.publishedAt = now();
    draft.updateTime = draft.publishedAt;
    this.touch(doc);
    const question = this.docs.find((d) => d.contentId === doc.questionId);
    if (question) question.lastActivityAt = now();
    return ok(this.detailOf(doc, userId));
  }

  private history(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    if (!this.readable(doc, userId)) return refuse('communityNotFound');
    const rows = doc.revisions
      .filter((r) => r.status !== 'draft')
      .sort((a, b) => b.revisionNo - a.revisionNo)
      .map((r) => this.revisionView(doc, r));
    return ok(paged(rows, request.query));
  }

  private oneRevision(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    const revision = doc.revisions.find(
      (r) => r.revisionId === num(request.params['revisionId']),
    );
    if (
      !revision ||
      (revision.status === 'draft' && !this.isOwner(doc, userId))
    ) {
      return refuse('communityNotFound');
    }
    return ok(this.revisionView(doc, revision));
  }

  // ---- lifecycle, tags, duplicate, accept ---------------------------------------------------

  private lifecycle(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    if (!this.readable(doc, userId)) return refuse('communityNotFound');
    const body = this.body(LifecycleCommandSchema, request);
    this.stale(body.expectedContentVersion, doc.version);
    const caps = this.capabilities(doc, userId, false);
    const allowed = {
      close: caps.canClose,
      reopen: caps.canReopen,
      archive: caps.canArchive,
      unarchive: doc.lifecycle === 'archived' && this.isOwner(doc, userId),
      soft_delete: caps.canDelete,
    }[body.action];
    if (!allowed) return refuse('communityStateInvalid');
    const occurredAt = now();
    switch (body.action) {
      case 'close':
        doc.lifecycle = 'closed';
        doc.closure = {
          action: 'close',
          reason: body.reason,
          actorUserId: userId,
          occurredAt,
        };
        break;
      case 'archive':
        doc.lifecycle = 'archived';
        doc.closure = {
          action: 'archive',
          reason: body.reason,
          actorUserId: userId,
          occurredAt,
        };
        break;
      case 'reopen':
      case 'unarchive':
        doc.lifecycle = 'active';
        doc.closure = null;
        // Reopening means the question is no longer treated as a duplicate.
        doc.duplicateOf = null;
        break;
      case 'soft_delete':
        doc.lifecycle = 'deleted';
        this.touch(doc);
        return ok({
          ...this.detailOf(doc, userId),
          publishedRevision: null,
          draftRevision: null,
        });
    }
    this.touch(doc);
    return ok(this.detailOf(doc, userId));
  }

  private setTags(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    this.editable(doc, userId);
    const body = this.body(TagsCommandSchema, request);
    this.stale(body.expectedContentVersion, doc.version);
    if (body.tagIds.some((t) => !this.tags.some((tag) => tag.tagId === t))) {
      return refuse('communityInvalidReference');
    }
    doc.tagIds = [...body.tagIds];
    this.touch(doc);
    return ok(this.detailOf(doc, userId));
  }

  private markDuplicate(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['questionId']));
    if (doc.kind !== 'question') return refuse('communityNotFound');
    const body = this.body(DuplicateCommandSchema, request);
    this.stale(body.expectedContentVersion, doc.version);
    if (
      !this.capabilities(doc, userId, false).canMarkDuplicate &&
      body.targetQuestionId !== null
    ) {
      return refuse('communityStateInvalid');
    }
    if (body.targetQuestionId !== null) {
      const target = this.docs.find(
        (d) => d.contentId === body.targetQuestionId,
      );
      if (
        !target ||
        target.kind !== 'question' ||
        target.contentId === doc.contentId ||
        !this.published(target)
      ) {
        return refuse('communityInvalidReference');
      }
      // Like the server: marking a duplicate closes the question.
      doc.duplicateOf = target.contentId;
      doc.lifecycle = 'closed';
      doc.closure = {
        action: 'duplicate',
        reason: body.reason,
        actorUserId: userId,
        occurredAt: now(),
      };
    } else {
      doc.duplicateOf = null;
      doc.closure = null;
    }
    this.touch(doc);
    return ok(this.detailOf(doc, userId));
  }

  private accept(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const question = this.doc(num(request.params['questionId']));
    if (question.kind !== 'question') return refuse('communityNotFound');
    if (!this.isOwner(question, userId)) return refuse('accessDenied');
    const body = this.body(AcceptCommandSchema, request);
    this.stale(body.expectedContentVersion, question.version);
    if (body.answerContentId === null) {
      question.acceptedAnswerId = null;
      question.acceptedRevisionId = null;
    } else {
      const answer = this.answersList(question).find(
        (a) => a.contentId === body.answerContentId,
      );
      const revision = answer && this.published(answer);
      if (
        !answer ||
        !revision ||
        revision.revisionId !== body.answerRevisionId
      ) {
        return refuse('communityAcceptInvalid');
      }
      question.acceptedAnswerId = answer.contentId;
      question.acceptedRevisionId = revision.revisionId;
    }
    this.touch(question);
    return ok(this.detailOf(question, userId));
  }

  // ---- votes, views, bookmarks, follows ---------------------------------------------------

  private vote(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    const body = this.body(VoteCommandSchema, request);
    if (!this.published(doc)) return refuse('communityNotFound');
    if (this.isOwner(doc, userId)) return refuse('communitySelfVote');
    if (doc.lifecycle !== 'active') return refuse('communityStateInvalid');
    const key = `${doc.contentId}:${userId}`;
    if (body.value === 0) this.votes.delete(key);
    else this.votes.set(key, body.value);
    let up = 0;
    let down = 0;
    for (const [k, v] of this.votes) {
      if (!k.startsWith(`${doc.contentId}:`)) continue;
      if (v > 0) up += 1;
      else down += 1;
    }
    return ok({
      contentId: doc.contentId,
      score: up - down,
      upvotes: up,
      downvotes: down,
      myVote: body.value,
    });
  }

  private recordView(request: FakeRequest): FakeReply {
    this.directory.callerId(request);
    this.doc(num(request.params['contentId']));
    return ok(null);
  }

  private setBookmark(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    const body = this.body(SetBookmarkCommandSchema, request);
    const key = `${doc.contentId}:${userId}`;
    if (body.saved) this.bookmarks.add(key);
    else this.bookmarks.delete(key);
    return ok({ contentId: doc.contentId, saved: body.saved });
  }

  private setSubscription(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const body = this.body(SubscriptionCommandSchema, request);
    const doc = this.doc(body.contentId);
    const key = `${doc.contentId}:${userId}`;
    if (body.mode === 'off') {
      this.subscriptions.delete(key);
      return ok(null);
    }
    this.subscriptions.set(key, body.mode);
    return ok({
      subscriptionId: doc.contentId,
      userId,
      targetType: 'content',
      targetId: String(doc.contentId),
      targetLabel: this.published(doc)?.title ?? null,
      deliveryMode: body.mode,
      version: 0,
    });
  }

  // ---- comments -------------------------------------------------------------------------------

  private commentView(comment: Comment, userId: string) {
    const doc = this.docs.find((d) => d.contentId === comment.contentId);
    const own = comment.authorUserId === userId;
    const open = doc?.lifecycle === 'active';
    const deleted = comment.status === 'deleted';
    return {
      commentId: comment.commentId,
      contentId: comment.contentId,
      authorUserId: deleted ? null : comment.authorUserId,
      parentCommentId: comment.parentCommentId,
      reviewThreadId: null,
      bodyMarkdown: deleted ? null : comment.bodyMarkdown,
      status: comment.status,
      createTime: comment.createTime,
      version: comment.version,
      author: deleted ? null : this.person(comment.authorUserId),
      revisionId: null,
      isDeleted: deleted,
      capabilities: {
        canEdit: own && !!open && !deleted,
        canDelete: own && !!open && !deleted,
        canReply: !!open && !deleted,
        canReport: !own && !deleted,
      },
      updateTime: comment.updateTime,
    };
  }

  private commentList(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    if (!this.readable(doc, userId)) return refuse('communityNotFound');
    const rows = this.comments
      .filter((c) => c.contentId === doc.contentId && c.status !== 'hidden')
      .sort(
        (a, b) =>
          a.createTime.localeCompare(b.createTime) || a.commentId - b.commentId,
      );
    return ok(
      paged(
        rows.map((c) => this.commentView(c, userId)),
        request.query,
      ),
    );
  }

  private depth(comment: Comment | undefined): number {
    let depth = 0;
    let cursor = comment;
    while (cursor) {
      depth += 1;
      const parentId: number | null = cursor.parentCommentId;
      cursor =
        parentId === null
          ? undefined
          : this.comments.find((c) => c.commentId === parentId);
    }
    return depth;
  }

  private createComment(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const doc = this.doc(num(request.params['contentId']));
    const body = this.body(CreateCommentCommandSchema, request);
    if (!this.published(doc)) return refuse('communityNotFound');
    if (doc.lifecycle !== 'active') return refuse('communityStateInvalid');
    const retried = this.comments.find(
      (c) =>
        c.authorUserId === userId && c.clientRequestId === body.clientRequestId,
    );
    if (retried) {
      return retried.bodyMarkdown === body.bodyMarkdown
        ? ok(this.commentView(retried, userId))
        : refuse('communityIdempotencyConflict');
    }
    if (body.parentCommentId !== undefined) {
      const parent = this.comments.find(
        (c) =>
          c.commentId === body.parentCommentId && c.contentId === doc.contentId,
      );
      if (!parent) return refuse('communityInvalidReference');
      if (this.depth(parent) >= 3) return refuse('communityStateInvalid');
    }
    const stamp = now();
    const comment: Comment = {
      commentId: this.id(),
      contentId: doc.contentId,
      authorUserId: userId,
      parentCommentId: body.parentCommentId ?? null,
      bodyMarkdown: body.bodyMarkdown,
      status: 'visible',
      createTime: stamp,
      updateTime: stamp,
      version: 0,
      clientRequestId: body.clientRequestId,
    };
    this.comments.push(comment);
    doc.lastActivityAt = stamp;
    return ok(this.commentView(comment, userId));
  }

  private ownComment(request: FakeRequest, userId: string): Comment {
    const comment = this.comments.find(
      (c) => c.commentId === num(request.params['commentId']),
    );
    if (!comment || comment.status !== 'visible')
      return refuse('communityNotFound');
    if (comment.authorUserId !== userId) return refuse('accessDenied');
    return comment;
  }

  private updateComment(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const comment = this.ownComment(request, userId);
    const body = this.body(UpdateCommentCommandSchema, request);
    this.stale(body.expectedVersion, comment.version);
    comment.bodyMarkdown = body.bodyMarkdown;
    comment.version += 1;
    comment.updateTime = now();
    return ok(this.commentView(comment, userId));
  }

  private deleteComment(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const comment = this.ownComment(request, userId);
    this.stale(num(request.query['expectedVersion']) ?? -1, comment.version);
    comment.status = 'deleted';
    comment.version += 1;
    return ok(null);
  }

  // ---- reports and moderation -----------------------------------------------------------------

  private requireModerator(request: FakeRequest): string {
    const userId = this.directory.callerId(request);
    if (!this.moderatorOf(userId)) return refuse('accessDenied');
    return userId;
  }

  private targetOf(report: Report) {
    if (report.commentId !== null) {
      const comment = this.comments.find(
        (c) => c.commentId === report.commentId,
      );
      const doc = this.docs.find((d) => d.contentId === comment?.contentId);
      return {
        kind: 'comment' as const,
        contentId: comment?.contentId ?? 0,
        title: doc ? (this.published(doc)?.title ?? null) : null,
      };
    }
    const doc = this.docs.find((d) => d.contentId === report.contentId);
    const kind =
      doc?.kind === 'lesson_learned' ? 'lesson' : (doc?.kind ?? 'article');
    return {
      kind: kind as 'question' | 'answer' | 'article' | 'lesson',
      contentId: report.contentId ?? 0,
      title: doc ? (this.published(doc)?.title ?? null) : null,
    };
  }

  private reportCard(report: Report) {
    return {
      reportId: report.reportId,
      reasonCode: report.reasonCode,
      status: report.status,
      reportedAt: report.reportedAt,
      assignedModerator: report.assignedUserId
        ? this.person(report.assignedUserId)
        : null,
      version: report.version,
      createTime: report.reportedAt,
      updateTime: report.reportedAt,
      target: this.targetOf(report),
    };
  }

  private actionView(action: Action) {
    return {
      actionId: action.actionId,
      actionType: action.actionType,
      reason: action.reason,
      actor: this.person(action.actorUserId),
      occurredAt: action.occurredAt,
    };
  }

  /** Description, reporter and history only for the moderator the case is assigned to. */
  private reportView(report: Report, userId: string) {
    const assigned = report.assignedUserId === userId;
    const moderator = this.moderatorOf(userId);
    const open = report.status === 'open' || report.status === 'in_review';
    return {
      ...this.reportCard(report),
      targetType: report.commentId !== null ? 'comment' : 'content',
      targetId: report.commentId ?? report.contentId,
      description: assigned ? report.description : null,
      reporter: assigned ? this.person(report.reporterUserId) : null,
      actions: assigned ? report.actions.map((a) => this.actionView(a)) : [],
      capabilities: {
        canAssign: moderator && report.status === 'open',
        canReadEvidence: assigned,
        canAct: assigned && open,
      },
    };
  }

  private createReport(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    const body = this.body(CreateReportCommandSchema, request);
    let doc: Doc | undefined;
    if (body.contentId !== undefined) {
      doc = this.doc(body.contentId);
    } else {
      const comment = this.comments.find((c) => c.commentId === body.commentId);
      if (!comment || comment.status !== 'visible')
        return refuse('communityNotFound');
      doc = this.doc(comment.contentId);
    }
    if (!this.published(doc)) return refuse('communityNotFound');
    const same = this.reports.find(
      (r) =>
        r.reporterUserId === userId &&
        r.reasonCode === body.reasonCode &&
        r.contentId === (body.contentId ?? null) &&
        r.commentId === (body.commentId ?? null) &&
        (r.status === 'open' || r.status === 'in_review'),
    );
    if (same) return ok(this.reportView(same, userId));
    const report: Report = {
      reportId: this.id(),
      contentId: body.contentId ?? null,
      commentId: body.commentId ?? null,
      reasonCode: body.reasonCode,
      description: body.description ?? null,
      reporterUserId: userId,
      reportedAt: now(),
      status: 'open',
      assignedUserId: null,
      version: 0,
      actions: [],
    };
    this.reports.push(report);
    return ok(this.reportView(report, userId));
  }

  private reportList(request: FakeRequest): FakeReply {
    const userId = this.requireModerator(request);
    const { status, assignedToMe } = request.query;
    const rows = this.reports
      .filter((r) => !status || r.status === status)
      .filter((r) => assignedToMe !== 'true' || r.assignedUserId === userId)
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
    return ok(
      paged(
        rows.map((r) => this.reportCard(r)),
        request.query,
      ),
    );
  }

  private report(request: FakeRequest): Report {
    const report = this.reports.find(
      (r) => r.reportId === num(request.params['reportId']),
    );
    return report ?? refuse('communityNotFound');
  }

  private reportOne(request: FakeRequest): FakeReply {
    const userId = this.requireModerator(request);
    return ok(this.reportView(this.report(request), userId));
  }

  private assignReport(request: FakeRequest): FakeReply {
    const userId = this.requireModerator(request);
    const report = this.report(request);
    const body = this.body(AssignReportCommandSchema, request);
    this.stale(body.expectedVersion, report.version);
    if (report.status === 'resolved' || report.status === 'dismissed') {
      return refuse('communityStateInvalid');
    }
    if (!this.moderatorOf(body.moderatorUserId))
      return refuse('communityInvalidReference');
    report.assignedUserId = body.moderatorUserId;
    report.status = 'in_review';
    report.version += 1;
    return ok(this.reportView(report, userId));
  }

  private evidence(request: FakeRequest): FakeReply {
    const userId = this.requireModerator(request);
    const report = this.report(request);
    if (report.assignedUserId !== userId) return refuse('accessDenied');
    const actions = report.actions.map((a) => this.actionView(a));
    if (report.commentId !== null) {
      const comment = this.comments.find(
        (c) => c.commentId === report.commentId,
      );
      if (!comment) return refuse('communityNotFound');
      return ok({
        reportId: report.reportId,
        targetType: 'comment',
        targetId: comment.commentId,
        targetVersion: comment.version,
        content: null,
        comment: {
          commentId: comment.commentId,
          contentId: comment.contentId,
          revisionId: null,
          bodyMarkdown: comment.bodyMarkdown,
          status: comment.status,
          deletedAt: null,
        },
        revisionId: null,
        actions,
      });
    }
    const doc = this.docs.find((d) => d.contentId === report.contentId);
    const revision = doc && this.published(doc);
    if (!doc || !revision) return refuse('communityNotFound');
    return ok({
      reportId: report.reportId,
      targetType: 'content',
      targetId: doc.contentId,
      targetVersion: doc.version,
      content: this.revisionView(doc, revision),
      comment: null,
      revisionId: revision.revisionId,
      actions,
    });
  }

  private actOnReport(request: FakeRequest): FakeReply {
    const userId = this.requireModerator(request);
    const report = this.report(request);
    if (report.assignedUserId !== userId) return refuse('accessDenied');
    const body = this.body(ModerationActionCommandSchema, request);
    this.stale(body.expectedReportVersion, report.version);
    if (report.status !== 'in_review') return refuse('communityStateInvalid');
    const doc =
      report.contentId !== null
        ? this.docs.find((d) => d.contentId === report.contentId)
        : undefined;
    const comment =
      report.commentId !== null
        ? this.comments.find((c) => c.commentId === report.commentId)
        : undefined;
    this.stale(
      body.expectedTargetVersion,
      doc?.version ?? comment?.version ?? 0,
    );
    switch (body.action) {
      case 'hide':
        if (doc) doc.lifecycle = 'hidden';
        if (comment) comment.status = 'hidden';
        break;
      case 'soft_delete':
        if (doc) doc.lifecycle = 'deleted';
        if (comment) comment.status = 'deleted';
        break;
      case 'close':
        if (!doc || doc.kind !== 'question')
          return refuse('communityStateInvalid');
        doc.lifecycle = 'closed';
        doc.closure = {
          action: 'moderated',
          reason: null,
          actorUserId: null,
          occurredAt: now(),
        };
        break;
      case 'warn':
      case 'dismiss':
        break;
      default:
        // Restore and maintainer changes are not part of Đợt 1.
        return refuse('communityStateInvalid');
    }
    if (doc) doc.version += 1;
    if (comment) comment.version += 1;
    report.actions.push({
      actionId: this.id(),
      actionType: body.action,
      reason: body.reason,
      actorUserId: userId,
      occurredAt: now(),
    });
    report.status = body.action === 'dismiss' ? 'dismissed' : 'resolved';
    report.version += 1;
    return ok(this.reportView(report, userId));
  }

  private moderatorView(m: Moderator) {
    return {
      moderatorId: m.moderatorId,
      userId: m.userId,
      orgId: m.orgId,
      status: m.status,
      version: m.version,
      user: this.person(m.userId),
      grantedBy: this.person(m.grantedByUserId),
      grantedAt: m.grantedAt,
      revokedAt: m.revokedAt,
      createTime: m.grantedAt,
      updateTime: m.revokedAt ?? m.grantedAt,
    };
  }

  /** An admin in scope or an active moderator of the org may read the roster and the candidates. */
  private requireRoster(
    request: FakeRequest,
    orgId: number | undefined,
  ): string {
    const userId = this.directory.callerId(request);
    const sameOrg =
      orgId !== undefined && this.directory.orgOf(userId) === orgId;
    if (
      !(this.directory.isAdmin(userId) || (sameOrg && this.moderatorOf(userId)))
    ) {
      return refuse('accessDenied');
    }
    return userId;
  }

  private moderatorList(request: FakeRequest): FakeReply {
    this.requireRoster(request, num(request.query['orgId']));
    const status = request.query['status'] ?? 'active';
    const rows = this.moderators
      .filter(
        (m) => m.orgId === num(request.query['orgId']) && m.status === status,
      )
      .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
    return ok(
      paged(
        rows.map((m) => this.moderatorView(m)),
        request.query,
      ),
    );
  }

  private setModerator(request: FakeRequest): FakeReply {
    const userId = this.directory.callerId(request);
    if (!this.directory.isAdmin(userId)) return refuse('accessDenied');
    const body = this.body(ModeratorCommandSchema, request);
    const target = request.params['userId'] ?? '';
    if (target === userId) return refuse('communityStateInvalid');
    if (this.directory.orgOf(target) !== body.orgId)
      return refuse('communityInvalidReference');
    const existing = this.moderators.find(
      (m) => m.userId === target && m.orgId === body.orgId,
    );
    if (existing) {
      if ((existing.status === 'active') === body.active)
        return ok(this.moderatorView(existing));
      this.stale(body.expectedVersion, existing.version);
      existing.status = body.active ? 'active' : 'revoked';
      existing.version += 1;
      existing.revokedAt = body.active ? null : now();
      if (body.active) {
        existing.grantedByUserId = userId;
        existing.grantedAt = now();
      }
      return ok(this.moderatorView(existing));
    }
    this.stale(body.expectedVersion, 0);
    if (!body.active) return refuse('communityStateInvalid');
    const created: Moderator = {
      moderatorId: this.id(),
      userId: target,
      orgId: body.orgId,
      status: 'active',
      version: 1,
      grantedByUserId: userId,
      grantedAt: now(),
      revokedAt: null,
    };
    this.moderators.push(created);
    return ok(this.moderatorView(created));
  }

  private candidates(request: FakeRequest): FakeReply {
    const orgId = num(request.query['orgId']);
    this.requireRoster(request, orgId);
    const q = (request.query['q'] ?? '').toLowerCase();
    const rows = this.directory
      .activePeople(orgId ?? 0)
      .filter(
        (p) =>
          !q || `${p.userId} ${p.displayName ?? ''}`.toLowerCase().includes(q),
      );
    return ok(paged(rows, request.query));
  }
}
