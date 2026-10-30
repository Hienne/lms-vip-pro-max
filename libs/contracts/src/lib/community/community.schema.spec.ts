import {
  AcceptCommandSchema,
  CapabilitiesSchema,
  ContentDetailSchema,
  CreateContentCommandSchema,
  CreateReportCommandSchema,
  LifecycleCommandSchema,
  PublishableContentSchema,
  PublishableLessonSchema,
  PublishableQuestionSchema,
  ReportViewSchema,
  SaveContentDraftCommandSchema,
  VoteCommandSchema,
} from './community.schema';

const UUID = '8c5fe9be-d989-4fa6-bac5-2e1d78b0880b';

const capabilities = {
  canEditDraft: false,
  canPublish: false,
  canAnswer: true,
  canComment: true,
  canVote: true,
  canAccept: false,
  canManageAccess: false,
  canReport: true,
  canClose: false,
  canReopen: false,
  canArchive: false,
  canDelete: false,
  canMarkDuplicate: false,
};

const detail = {
  contentId: 101,
  kind: 'question',
  ownerOrgId: 1,
  author: { userId: '000123', displayName: 'Nguyễn Văn A' },
  maintainer: { userId: '000123', displayName: 'Nguyễn Văn A' },
  lifecycleStatus: 'active',
  visibility: 'organization',
  contentVersion: 3,
  publishedRevision: null,
  draftRevision: null,
  tags: [],
  capabilities,
  acceptedRevisionIsCurrent: false,
  answerCount: 0,
  score: 0,
  myVote: 0,
  saved: false,
  isDuplicate: false,
};

describe('community schemas', () => {
  it('parses a content detail with the fields the screens add', () => {
    const parsed = ContentDetailSchema.parse({
      ...detail,
      subscriptionMode: 'instant',
      duplicateTarget: { contentId: 7, kind: 'question', title: 'Câu hỏi gốc' },
      closure: {
        action: 'close',
        reason: 'Đã có hướng dẫn',
        actor: { userId: '000001', displayName: 'Điều phối' },
        occurredAt: '2026-10-27T01:02:03Z',
      },
    });
    expect(parsed.subscriptionMode).toBe('instant');
    expect(parsed.closure?.action).toBe('close');
  });

  it('keeps the userId leading zeros and drops unknown keys', () => {
    const parsed = ContentDetailSchema.parse({ ...detail, extra: 1 });
    expect(parsed.author?.userId).toBe('000123');
    expect('extra' in parsed).toBe(false);
  });

  it('rejects capabilities that miss a flag the screens rely on', () => {
    const { canClose: _canClose, ...rest } = capabilities;
    expect(CapabilitiesSchema.safeParse(rest).success).toBe(false);
  });

  it('parses a report with its target', () => {
    const report = ReportViewSchema.parse({
      reportId: 5,
      reasonCode: 'spam',
      status: 'open',
      version: 0,
      target: { kind: 'comment', contentId: 101, title: 'Tiêu đề' },
      description: null,
      reporter: null,
      actions: [],
    });
    expect(report.target?.kind).toBe('comment');
  });

  describe('commands', () => {
    it('refuse a key the server does not accept', () => {
      const result = CreateContentCommandSchema.safeParse({
        clientRequestId: UUID,
        title: 'Oracle UCP timeout',
        bodyMarkdown: '',
        kind: 'question',
      });
      expect(result.success).toBe(false);
    });

    it('allow an empty draft body but cap its length', () => {
      expect(
        CreateContentCommandSchema.safeParse({
          clientRequestId: UUID,
          title: '',
          bodyMarkdown: '',
        }).success,
      ).toBe(true);
      expect(
        CreateContentCommandSchema.safeParse({
          clientRequestId: UUID,
          title: 'x'.repeat(256),
          bodyMarkdown: '',
        }).success,
      ).toBe(false);
    });

    it('limit a draft to ten tags and a change note to 500 characters', () => {
      const base = {
        expectedContentVersion: 0,
        expectedRevisionVersion: 0,
        title: 'Tiêu đề',
        bodyMarkdown: '',
      };
      expect(
        CreateContentCommandSchema.safeParse({
          clientRequestId: UUID,
          title: 't',
          bodyMarkdown: '',
          tagIds: Array.from({ length: 11 }, (_, i) => i + 1),
        }).success,
      ).toBe(false);
      expect(
        SaveContentDraftCommandSchema.safeParse({
          ...base,
          changeNote: 'x'.repeat(501),
        }).success,
      ).toBe(false);
      expect(
        SaveContentDraftCommandSchema.safeParse({ ...base, changeNote: 'Sửa' })
          .success,
      ).toBe(true);
    });

    it('accept an answer or clear it, never half of it', () => {
      expect(
        AcceptCommandSchema.safeParse({
          expectedContentVersion: 2,
          answerContentId: 102,
          answerRevisionId: 205,
        }).success,
      ).toBe(true);
      expect(
        AcceptCommandSchema.safeParse({
          expectedContentVersion: 3,
          answerContentId: null,
          answerRevisionId: null,
        }).success,
      ).toBe(true);
      expect(
        AcceptCommandSchema.safeParse({
          expectedContentVersion: 3,
          answerContentId: 102,
          answerRevisionId: null,
        }).success,
      ).toBe(false);
    });

    it('need a reason of 5 to 3000 characters for a lifecycle change', () => {
      const command = {
        expectedContentVersion: 1,
        action: 'close',
        reason: 'abcd',
      };
      expect(LifecycleCommandSchema.safeParse(command).success).toBe(false);
      expect(
        LifecycleCommandSchema.safeParse({ ...command, reason: 'abcde' })
          .success,
      ).toBe(true);
      expect(
        LifecycleCommandSchema.safeParse({
          ...command,
          reason: 'x'.repeat(3_001),
        }).success,
      ).toBe(false);
    });

    it('report exactly one target', () => {
      expect(
        CreateReportCommandSchema.safeParse({ reasonCode: 'spam' }).success,
      ).toBe(false);
      expect(
        CreateReportCommandSchema.safeParse({
          contentId: 1,
          commentId: 2,
          reasonCode: 'spam',
        }).success,
      ).toBe(false);
      expect(
        CreateReportCommandSchema.safeParse({
          commentId: 2,
          reasonCode: 'spam',
        }).success,
      ).toBe(true);
    });

    it('vote only -1, 0 or 1', () => {
      expect(VoteCommandSchema.safeParse({ value: 2 }).success).toBe(false);
      expect(VoteCommandSchema.safeParse({ value: -1 }).success).toBe(true);
    });
  });

  describe('publish rules', () => {
    const ok = {
      title: 'Oracle UCP',
      bodyMarkdown: 'Nội dung đủ hai mươi ký tự.',
      tagIds: [],
    };

    it('need a title of 5 and a body of 20 characters', () => {
      expect(PublishableContentSchema.safeParse(ok).success).toBe(true);
      expect(
        PublishableContentSchema.safeParse({ ...ok, title: 'Ora ' }).success,
      ).toBe(false);
      expect(
        PublishableContentSchema.safeParse({ ...ok, bodyMarkdown: 'ngắn' })
          .success,
      ).toBe(false);
    });

    it('count a padded title by its trimmed length', () => {
      expect(
        PublishableContentSchema.safeParse({ ...ok, title: '  ab  ' }).success,
      ).toBe(false);
    });

    it('need at least one tag for a question', () => {
      expect(PublishableQuestionSchema.safeParse(ok).success).toBe(false);
      expect(
        PublishableQuestionSchema.safeParse({ ...ok, tagIds: [11] }).success,
      ).toBe(true);
    });

    it('need the four lesson fields', () => {
      const long = 'x'.repeat(20);
      expect(
        PublishableLessonSchema.safeParse({
          ...ok,
          lessonLearned: {
            symptoms: long,
            rootCause: long,
            resolution: long,
            prevention: 'ngắn',
          },
        }).success,
      ).toBe(false);
      expect(
        PublishableLessonSchema.safeParse({
          ...ok,
          lessonLearned: {
            symptoms: long,
            rootCause: long,
            resolution: long,
            prevention: long,
          },
        }).success,
      ).toBe(true);
    });
  });
});
