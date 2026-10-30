import {
  authV1Endpoints,
  communityEndpoints,
  type AnyEndpoint,
  type Page,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD, SEED_USERS } from '../backend/seed';

const e = communityEndpoints;
const UUID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('CommunityBackend', () => {
  let backend: FakeBackend;
  let seq: number;

  const login = (username: string): string => {
    const reply = backend.handle(authV1Endpoints.login, {
      token: null,
      params: {},
      query: {},
      body: { username, password: SEED_PASSWORD },
    });
    return (reply?.body.data as { accessToken: string }).accessToken;
  };

  const call = (
    endpoint: AnyEndpoint,
    token: string,
    input: {
      params?: Record<string, string | number>;
      query?: Record<string, string | number>;
      body?: unknown;
    } = {},
  ): FakeReply => {
    const reply = backend.handle(endpoint, {
      token,
      params: Object.fromEntries(
        Object.entries(input.params ?? {}).map(([k, v]) => [k, String(v)]),
      ),
      query: Object.fromEntries(
        Object.entries(input.query ?? {}).map(([k, v]) => [k, String(v)]),
      ),
      body: input.body,
    });
    if (!reply) throw new Error(`Not answered: ${endpoint.path}`);
    if (reply.body.status === 'SUCCESS' && !('file' in reply)) {
      // Every success must satisfy the contract the app parses it with.
      expect(() => endpoint.response.parse(reply.body.data)).not.toThrow();
    }
    return reply;
  };

  const data = <T>(reply: FakeReply) => reply.body.data as T;
  const code = (reply: FakeReply) => reply.body.messageCode;

  let learner: string;
  let other: string;
  let moderator: string;
  let admin: string;

  beforeEach(() => {
    backend = new FakeBackend();
    seq = 100;
    learner = login('hocvien');
    other = login('hocvien.tichhop');
    moderator = login('dieuphoi');
    admin = login('quantri');
  });

  const draftQuestion = (token: string, tagIds: number[] = [1]) =>
    data<{
      contentId: number;
      contentVersion: number;
      draftRevision: { revisionVersion: number };
    }>(
      call(e.createQuestion, token, {
        body: {
          clientRequestId: UUID(seq++),
          title: 'Câu hỏi mới về pool',
          bodyMarkdown: 'Nội dung đủ dài để có thể xuất bản câu hỏi.',
          tagIds,
        },
      }),
    );

  it('seeds a moderator and gives only them the moderation menu through /me', () => {
    expect(SEED_USERS.map((u) => u.username)).toContain('dieuphoi');
    const functions = (token: string) =>
      data<{ functions: string[] }>(call(authV1Endpoints.me, token)).functions;
    expect(functions(moderator)).toContain('COMMUNITY_MODERATION');
    expect(functions(learner)).not.toContain('COMMUNITY_MODERATION');
    expect(functions(learner)).toContain('COMMUNITY');
  });

  describe('questions', () => {
    it('lists published questions with computed counts and resolution', () => {
      const page = data<
        Page<{
          contentId: number;
          answerCount: number;
          resolutionStatus: string;
        }>
      >(call(e.questions, learner));
      const solved = page.items.find((q) => q.contentId === 101);
      expect(solved).toMatchObject({
        answerCount: 2,
        resolutionStatus: 'solved',
      });
      expect(
        page.items.find((q) => q.contentId === 106)?.resolutionStatus,
      ).toBe('unanswered');
    });

    it('filters by text, tag and resolution', () => {
      const ids = (query: Record<string, string>) =>
        data<Page<{ contentId: number }>>(
          call(e.questions, learner, { query }),
        ).items.map((q) => q.contentId);
      expect(ids({ q: 'kafka' })).toEqual([104]);
      expect(ids({ tagIds: '4,9' }).sort()).toEqual([106, 107]);
      expect(ids({ resolutionStatus: 'answered' })).toEqual([104]);
    });

    it('suggests similar questions from the title', () => {
      const rows = data<{ contentId: number }[]>(
        call(e.questionSuggestions, learner, {
          query: { q: 'timeout Oracle connection' },
        }),
      );
      expect(rows.map((r) => r.contentId)).toContain(101);
    });
  });

  describe('draft, publish and versions', () => {
    it('creates a draft that readers cannot see, then publishes it', () => {
      const created = draftQuestion(learner);
      expect(
        code(
          call(e.content, other, { params: { contentId: created.contentId } }),
        ),
      ).toBe('CORE-RESOURCE_NOT_FOUND');
      const published = call(e.publishContent, learner, {
        params: { contentId: created.contentId },
        body: {
          expectedContentVersion: created.contentVersion,
          expectedRevisionVersion: created.draftRevision.revisionVersion,
        },
      });
      expect(published.body.status).toBe('SUCCESS');
      const read = call(e.content, other, {
        params: { contentId: created.contentId },
      });
      expect(
        data<{ publishedRevision: { title: string } }>(read).publishedRevision
          .title,
      ).toBe('Câu hỏi mới về pool');
    });

    it('answers a retried create with the same resource and refuses another payload', () => {
      const body = {
        clientRequestId: UUID(1),
        title: 'Câu hỏi lặp',
        bodyMarkdown: 'Nội dung đủ dài để có thể xuất bản.',
        tagIds: [1],
      };
      const first = data<{ contentId: number }>(
        call(e.createQuestion, learner, { body }),
      );
      const again = data<{ contentId: number }>(
        call(e.createQuestion, learner, { body }),
      );
      expect(again.contentId).toBe(first.contentId);
      expect(
        code(
          call(e.createQuestion, learner, {
            body: { ...body, title: 'Khác hẳn' },
          }),
        ),
      ).toBe('COMMUNITY-IDEMPOTENCY_CONFLICT');
    });

    it('refuses NOT_PUBLISHABLE for a question without a tag', () => {
      const created = draftQuestion(learner, []);
      const reply = call(e.publishContent, learner, {
        params: { contentId: created.contentId },
        body: {
          expectedContentVersion: created.contentVersion,
          expectedRevisionVersion: 0,
        },
      });
      expect(code(reply)).toBe('COMMUNITY-NOT_PUBLISHABLE');
    });

    it('refuses a stale draft save with CONFLICT and keeps the draft', () => {
      const created = draftQuestion(learner);
      const save = (expectedRevisionVersion: number) =>
        call(e.saveDraft, learner, {
          params: { contentId: created.contentId },
          body: {
            expectedContentVersion: created.contentVersion,
            expectedRevisionVersion,
            title: 'Đã sửa tiêu đề',
            bodyMarkdown: 'Nội dung đã sửa đủ hai mươi ký tự.',
            changeNote: 'Sửa tiêu đề',
          },
        });
      expect(save(0).body.status).toBe('SUCCESS');
      expect(code(save(0))).toBe('COMMUNITY-CONFLICT');
    });

    it('rejects a body with an extra key as a validation failure', () => {
      const reply = call(e.createQuestion, learner, {
        body: {
          clientRequestId: UUID(2),
          title: 't',
          bodyMarkdown: '',
          kind: 'article',
        },
      });
      expect(code(reply)).toBe('CORE-VALIDATION_FAILED');
    });
  });

  describe('capabilities and lifecycle', () => {
    const detail = (token: string, contentId: number) =>
      data<{
        capabilities: Record<string, boolean>;
        lifecycleStatus: string;
        contentVersion: number;
        closure: { action: string; reason: string } | null;
      }>(call(e.content, token, { params: { contentId } }));

    it('lets only the author close and mark duplicates', () => {
      expect(detail(learner, 101).capabilities).toMatchObject({
        canClose: true,
        canMarkDuplicate: true,
        canAccept: true,
        canVote: false,
      });
      expect(detail(other, 101).capabilities).toMatchObject({
        canClose: false,
        canVote: true,
        canReport: true,
      });
    });

    it('closes and reopens a question with a reason', () => {
      const before = detail(learner, 101);
      const closed = call(e.changeLifecycle, learner, {
        params: { contentId: 101 },
        body: {
          expectedContentVersion: before.contentVersion,
          action: 'close',
          reason: 'Đã có hướng dẫn',
        },
      });
      expect(data<{ lifecycleStatus: string }>(closed).lifecycleStatus).toBe(
        'closed',
      );
      expect(detail(learner, 101).closure).toMatchObject({
        action: 'close',
        reason: 'Đã có hướng dẫn',
      });
      const now = detail(learner, 101);
      expect(now.capabilities['canReopen']).toBe(true);
      expect(
        call(e.changeLifecycle, learner, {
          params: { contentId: 101 },
          body: {
            expectedContentVersion: now.contentVersion,
            action: 'reopen',
            reason: 'Mở lại',
          },
        }).body.status,
      ).toBe('SUCCESS');
    });

    it('drops the duplicate mark when the question is reopened', () => {
      const before = detail(learner, 101);
      call(e.markDuplicate, learner, {
        params: { questionId: 101 },
        body: {
          expectedContentVersion: before.contentVersion,
          targetQuestionId: 107,
          reason: 'Trùng câu hỏi cũ',
        },
      });
      const marked = data<{ isDuplicate: boolean; contentVersion: number }>(
        call(e.content, learner, { params: { contentId: 101 } }),
      );
      expect(marked.isDuplicate).toBe(true);

      call(e.changeLifecycle, learner, {
        params: { contentId: 101 },
        body: {
          expectedContentVersion: marked.contentVersion,
          action: 'reopen',
          reason: 'Không trùng',
        },
      });
      expect(
        data<{ isDuplicate: boolean; lifecycleStatus: string }>(
          call(e.content, learner, { params: { contentId: 101 } }),
        ),
      ).toMatchObject({ isDuplicate: false, lifecycleStatus: 'active' });
    });

    it('names no moderator and no case reason when a moderator closes a question', () => {
      const { reportId } = data<{ reportId: number }>(
        call(e.createReport, other, {
          body: { contentId: 101, reasonCode: 'spam', description: 'Lạc đề' },
        }),
      );
      call(e.assignReport, moderator, {
        params: { reportId },
        body: { expectedVersion: 0, moderatorUserId: '000008' },
      });
      call(e.actOnReport, moderator, {
        params: { reportId },
        body: {
          expectedReportVersion: 1,
          expectedTargetVersion: detail(learner, 101).contentVersion,
          action: 'close',
          reason: 'Đóng theo hồ sơ báo cáo của người khác',
        },
      });

      expect(detail(learner, 101).closure).toMatchObject({
        action: 'moderated',
        reason: null,
        actor: null,
      });
      expect(detail(learner, 101).capabilities['canReopen']).toBe(false);
    });

    it('refuses a stale lifecycle change with CONFLICT', () => {
      const reply = call(e.changeLifecycle, learner, {
        params: { contentId: 101 },
        body: {
          expectedContentVersion: 99,
          action: 'close',
          reason: 'Đã có hướng dẫn',
        },
      });
      expect(code(reply)).toBe('COMMUNITY-CONFLICT');
    });
  });

  describe('votes, bookmarks, follows and comments', () => {
    it('sets a vote and refuses voting on your own content', () => {
      const voted = data<{ score: number; myVote: number }>(
        call(e.vote, other, { params: { contentId: 106 }, body: { value: 1 } }),
      );
      expect(voted).toMatchObject({ score: 1, myVote: 1 });
      expect(
        code(
          call(e.vote, learner, {
            params: { contentId: 101 },
            body: { value: 1 },
          }),
        ),
      ).toBe('COMMUNITY-SELF_VOTE');
    });

    it('saves a content to the bookmarks and reports it saved on the detail', () => {
      call(e.setBookmark, learner, {
        params: { contentId: 110 },
        body: { saved: true },
      });
      const saved = data<Page<{ contentId: number }>>(
        call(e.bookmarks, learner),
      );
      expect(saved.items.map((c) => c.contentId)).toEqual([110]);
      expect(
        data<{ saved: boolean }>(
          call(e.content, learner, { params: { contentId: 110 } }),
        ).saved,
      ).toBe(true);
    });

    it('follows a content and stops with off', () => {
      call(e.setSubscription, learner, {
        body: { contentId: 101, mode: 'instant' },
      });
      expect(
        data<{ subscriptionMode: string }>(
          call(e.content, learner, { params: { contentId: 101 } }),
        ).subscriptionMode,
      ).toBe('instant');
      const off = call(e.setSubscription, learner, {
        body: { contentId: 101, mode: 'off' },
      });
      expect(off.body.data).toBeNull();
    });

    it('posts a reply, edits it and soft-deletes it with the comment version', () => {
      const posted = data<{ commentId: number; version: number }>(
        call(e.createComment, learner, {
          params: { contentId: 101 },
          body: {
            clientRequestId: UUID(50),
            parentCommentId: 1,
            bodyMarkdown: 'Cảm ơn bạn',
          },
        }),
      );
      const edited = data<{ version: number }>(
        call(e.updateComment, learner, {
          params: { commentId: posted.commentId },
          body: {
            expectedVersion: posted.version,
            bodyMarkdown: 'Cảm ơn bạn nhiều',
          },
        }),
      );
      expect(
        code(
          call(e.deleteComment, learner, {
            params: { commentId: posted.commentId },
            query: { expectedVersion: posted.version },
          }),
        ),
      ).toBe('COMMUNITY-CONFLICT');
      expect(
        call(e.deleteComment, learner, {
          params: { commentId: posted.commentId },
          query: { expectedVersion: edited.version },
        }).body.status,
      ).toBe('SUCCESS');
    });
  });

  describe('moderation', () => {
    it('refuses the queue to anyone who is not a moderator, an admin included', () => {
      expect(call(e.reports, learner).status).toBe(403);
      expect(call(e.reports, admin).status).toBe(403);
      expect(call(e.reports, moderator).status).toBe(200);
    });

    it('hides the description and history until the moderator takes the case', () => {
      const view = (token: string) =>
        data<{
          description: string | null;
          actions: unknown[];
          capabilities: Record<string, boolean>;
          target: { kind: string; contentId: number };
        }>(call(e.report, token, { params: { reportId: 1 } }));
      expect(view(moderator)).toMatchObject({
        description: null,
        capabilities: { canAssign: true, canReadEvidence: false },
        target: { kind: 'answer', contentId: 103 },
      });
      const assigned = call(e.assignReport, moderator, {
        params: { reportId: 1 },
        body: { expectedVersion: 0, moderatorUserId: '000008' },
      });
      expect(assigned.body.status).toBe('SUCCESS');
      expect(view(moderator).description).toContain('Câu trả lời');
      expect(
        call(e.reportEvidence, moderator, { params: { reportId: 1 } }).body
          .status,
      ).toBe('SUCCESS');
    });

    it('resolves a report by hiding the reported answer', () => {
      call(e.assignReport, moderator, {
        params: { reportId: 1 },
        body: { expectedVersion: 0, moderatorUserId: '000008' },
      });
      const done = call(e.actOnReport, moderator, {
        params: { reportId: 1 },
        body: {
          expectedReportVersion: 1,
          expectedTargetVersion: 1,
          action: 'hide',
          reason: 'Có thông tin sai lệch',
        },
      });
      expect(data<{ status: string }>(done).status).toBe('resolved');
      expect(code(call(e.content, other, { params: { contentId: 103 } }))).toBe(
        'CORE-RESOURCE_NOT_FOUND',
      );
    });

    it('lets a reader report a content and answers the same report twice', () => {
      const body = {
        contentId: 110,
        reasonCode: 'spam',
        description: 'Quảng cáo',
      };
      const first = data<{ reportId: number }>(
        call(e.createReport, other, { body }),
      );
      const again = data<{ reportId: number }>(
        call(e.createReport, other, { body }),
      );
      expect(again.reportId).toBe(first.reportId);
    });

    it('lets an admin appoint and revoke a moderator with the grant version', () => {
      const candidates = data<Page<{ userId: string }>>(
        call(e.moderatorCandidates, admin, {
          query: { orgId: 1, q: 'tích hợp' },
        }),
      );
      expect(candidates.items.map((p) => p.userId)).toEqual(['000007']);
      const granted = data<{ version: number; status: string }>(
        call(e.setModerator, admin, {
          params: { userId: '000007' },
          body: {
            orgId: 1,
            active: true,
            reason: 'Phụ trách mảng tích hợp',
            expectedVersion: 0,
          },
        }),
      );
      expect(granted.status).toBe('active');
      const revoked = call(e.setModerator, admin, {
        params: { userId: '000007' },
        body: {
          orgId: 1,
          active: false,
          reason: 'Chuyển công tác',
          expectedVersion: granted.version,
        },
      });
      expect(data<{ status: string }>(revoked).status).toBe('revoked');
      expect(
        data<Page<unknown>>(
          call(e.moderators, admin, { query: { orgId: 1, status: 'revoked' } }),
        ).totalElements,
      ).toBe(1);
    });

    it('refuses appointing to a learner and to a moderator', () => {
      const body = {
        orgId: 1,
        active: true,
        reason: 'Thử cấp quyền',
        expectedVersion: 0,
      };
      expect(
        call(e.setModerator, learner, { params: { userId: '000007' }, body })
          .status,
      ).toBe(403);
      expect(
        call(e.setModerator, moderator, { params: { userId: '000007' }, body })
          .status,
      ).toBe(403);
    });
  });
});
