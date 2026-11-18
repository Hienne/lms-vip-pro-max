import { toUrl } from '../http/endpoint';
import { draftingSessionEndpoints } from './drafting-session.endpoints';
import {
  AudienceProposalSchema,
  BasicsProposalSchema,
  ConfirmBasicsCommandSchema,
  ConfirmOutlineCommandSchema,
  ConfirmRulesCommandSchema,
  DraftingCardSchema,
  DraftingSessionSchema,
  DraftingStepSchema,
  OutlineProposalSchema,
  RulesProposalSchema,
  StartDraftingFieldsSchema,
} from './drafting-session.schema';

const time = '2026-11-17T09:00:00+07:00';

const basics = {
  title: 'Quy trình đối soát cuối ngày',
  summary: 'Các bước đối soát giao dịch cuối ngày.',
  objectives: ['Nắm các bước đối soát'],
  level: 'basic',
  defaultRequirement: 'mandatory',
  programId: 3,
  moduleId: null,
  code: 'AI-7K2M9QXA',
  unsure: ['moduleId'],
};

const outline = {
  chapters: [
    {
      title: 'Tổng quan',
      lessons: [
        {
          title: 'Mục đích của đối soát',
          description: 'Vì sao phải đối soát mỗi ngày.',
          sourceSection: 'Mục 1. Giới thiệu',
        },
      ],
    },
  ],
};

const question = {
  type: 'SINGLE',
  content: 'Đối soát cuối ngày làm khi nào?',
  explanation: null,
  difficulty: 'EASY',
  options: [
    { content: 'Sau khi khóa sổ', correct: true },
    { content: 'Đầu ngày', correct: false },
  ],
  sourceSection: 'Mục 2. Các bước',
};

const rules = { rewardPoints: 10, competencyId: 4, questions: [question] };

const audience = {
  targets: [
    {
      targetType: 'org',
      orgId: 2,
      includeDescendants: true,
      label: 'Chi nhánh Hà Nội',
    },
    { targetType: 'user', userId: '000004', label: 'Nguyễn Văn A' },
  ],
  publishBlockers: ['Chưa có ảnh bìa', '3 bài chưa có nội dung'],
};

const step = (n: number, proposal: unknown, state = 'proposed') => ({
  step: n,
  state,
  proposal,
  notes: [],
  error: null,
  updateTime: time,
});

const session = (steps: unknown[]) => ({
  id: 12,
  status: 'active',
  currentStep: Math.max(1, steps.length),
  courseId: null,
  revisionId: null,
  conversationId: null,
  source: { documentId: 40, fileName: 'quy-trinh.pdf', status: 'ready' },
  error: null,
  steps,
  createTime: time,
  updateTime: time,
});

describe('drafting proposals', () => {
  it('reads a basics proposal with an empty programme and unsure fields', () => {
    const parsed = BasicsProposalSchema.parse({
      ...basics,
      programId: null,
      level: null,
      defaultRequirement: null,
      unsure: ['programId', 'level', 'defaultRequirement'],
    });
    expect(parsed.programId).toBeNull();
    expect(parsed.unsure).toEqual(['programId', 'level', 'defaultRequirement']);
  });

  it('refuses a basics proposal with a level the course does not have', () => {
    expect(
      BasicsProposalSchema.safeParse({ ...basics, level: 'BEGINNER' }).success,
    ).toBe(false);
    expect(
      BasicsProposalSchema.safeParse({ ...basics, unsure: ['code'] }).success,
    ).toBe(false);
  });

  it('reads a basics proposal that holds only the new code after a taken one on a hand-filled step', () => {
    const parsed = BasicsProposalSchema.parse({ code: 'KH-0042' });
    expect(parsed).toEqual({ code: 'KH-0042' });
    expect(BasicsProposalSchema.safeParse({}).success).toBe(false);
  });

  it('reads an outline whose lessons carry a description and source section', () => {
    const parsed = OutlineProposalSchema.parse(outline);
    expect(parsed.chapters[0].lessons[0].sourceSection).toBe(
      'Mục 1. Giới thiệu',
    );
    expect(
      OutlineProposalSchema.safeParse({
        chapters: [{ title: 'x', lessons: [{ title: 'y' }] }],
      }).success,
    ).toBe(false);
  });

  it('reads rules whose questions use content and correct, not text', () => {
    expect(
      RulesProposalSchema.parse(rules).questions[0].options[0].correct,
    ).toBe(true);
    expect(
      RulesProposalSchema.parse({ ...rules, competencyId: null }).competencyId,
    ).toBeNull();
    expect(
      RulesProposalSchema.safeParse({
        ...rules,
        questions: [{ ...question, options: [{ text: 'a', correct: true }] }],
      }).success,
    ).toBe(false);
  });

  it('reads audience targets with their labels and the publish blockers', () => {
    const parsed = AudienceProposalSchema.parse(audience);
    expect(parsed.targets.map((target) => target.label)).toEqual([
      'Chi nhánh Hà Nội',
      'Nguyễn Văn A',
    ]);
    expect(
      AudienceProposalSchema.safeParse({
        ...audience,
        targets: [{ targetType: 'org', orgId: 2 }],
      }).success,
    ).toBe(false);
  });
});

describe('DraftingStepSchema', () => {
  it('picks the proposal shape by step number', () => {
    expect(DraftingStepSchema.parse(step(1, basics)).step).toBe(1);
    expect(DraftingStepSchema.parse(step(2, outline)).step).toBe(2);
    expect(DraftingStepSchema.parse(step(3, rules)).step).toBe(3);
    expect(DraftingStepSchema.parse(step(4, audience)).step).toBe(4);
    expect(DraftingStepSchema.safeParse(step(1, outline)).success).toBe(false);
    expect(DraftingStepSchema.safeParse(step(5, null)).success).toBe(false);
  });

  it('has no proposal while proposing and an error when failed', () => {
    expect(
      DraftingStepSchema.parse(step(1, null, 'proposing')).proposal,
    ).toBeNull();
    const failed = DraftingStepSchema.parse({
      ...step(1, null, 'failed'),
      error: 'Không đọc được tài liệu nguồn.',
    });
    expect(failed.error).toBe('Không đọc được tài liệu nguồn.');
    expect(DraftingStepSchema.safeParse(step(1, null, 'running')).success).toBe(
      false,
    );
  });

  it('keeps the lesson notes of a confirmed outline', () => {
    const parsed = DraftingStepSchema.parse({
      ...step(2, outline, 'confirmed'),
      lessonNotes: [
        {
          lessonId: 91,
          description: 'Vì sao phải đối soát.',
          sourceSection: 'Mục 1',
        },
      ],
    });
    expect(parsed.step === 2 && parsed.lessonNotes?.[0].lessonId).toBe(91);
  });
});

describe('DraftingSessionSchema', () => {
  it('reads a session at step 4 with every earlier step', () => {
    const parsed = DraftingSessionSchema.parse({
      ...session([
        step(1, basics, 'confirmed'),
        step(2, outline, 'confirmed'),
        step(3, rules, 'confirmed'),
        step(4, audience),
      ]),
      courseId: 501,
      revisionId: 601,
      conversationId: 7,
    });
    expect(parsed.steps.map((item) => item.state)).toEqual([
      'confirmed',
      'confirmed',
      'confirmed',
      'proposed',
    ]);
  });

  it('reads a session without a source and refuses an unknown status', () => {
    expect(
      DraftingSessionSchema.parse({ ...session([]), source: null }).source,
    ).toBeNull();
    expect(
      DraftingSessionSchema.safeParse({ ...session([]), status: 'running' })
        .success,
    ).toBe(false);
    expect(
      DraftingSessionSchema.safeParse({ ...session([]), currentStep: 0 })
        .success,
    ).toBe(false);
  });
});

describe('drafting commands', () => {
  it('confirms step 1 with a create-course command', () => {
    expect(() =>
      ConfirmBasicsCommandSchema.parse({
        course: { ownerOrgId: 1, code: 'AI-7K2M9QXA', title: 'Đối soát' },
      }),
    ).not.toThrow();
  });

  it('confirms step 2 with a draft and step 3 with a competency and kept questions', () => {
    const draft = {
      expectedVersion: 0,
      defaultRequirement: 'mandatory',
      objectives: [],
      chapters: [],
    };
    expect(() => ConfirmOutlineCommandSchema.parse({ draft })).not.toThrow();
    expect(() =>
      ConfirmRulesCommandSchema.parse({
        draft,
        competencyId: 4,
        questions: [question],
      }),
    ).not.toThrow();
    expect(
      ConfirmRulesCommandSchema.safeParse({ draft, questions: [] }).success,
    ).toBe(false);
  });

  it('takes start fields in the course level values', () => {
    expect(StartDraftingFieldsSchema.parse({ level: 'advanced' }).level).toBe(
      'advanced',
    );
    expect(
      StartDraftingFieldsSchema.safeParse({ level: 'ADVANCED' }).success,
    ).toBe(false);
  });

  it('reads a chat card', () => {
    expect(
      DraftingCardSchema.parse({
        sessionId: 12,
        step: 2,
        state: 'proposed',
        courseId: 501,
      }).step,
    ).toBe(2);
  });
});

describe('draftingSessionEndpoints', () => {
  it('builds the pinned paths under drafting-sessions', () => {
    expect(draftingSessionEndpoints.start.path).toBe(
      '/api/v1/assistant/drafting-sessions',
    );
    expect(draftingSessionEndpoints.uploadSource.path).toBe(
      '/api/v1/assistant/drafting-sessions/sources',
    );
    expect(toUrl(draftingSessionEndpoints.get, { sessionId: 12 })).toBe(
      '/api/v1/assistant/drafting-sessions/12',
    );
    expect(toUrl(draftingSessionEndpoints.forCourse, { courseId: 501 })).toBe(
      '/api/v1/assistant/drafting-sessions/course/501',
    );
    expect(
      toUrl(draftingSessionEndpoints.confirm, { sessionId: 12, step: 3 }),
    ).toBe('/api/v1/assistant/drafting-sessions/12/steps/3/confirm');
    expect(
      toUrl(draftingSessionEndpoints.proposeAgain, { sessionId: 12, step: 2 }),
    ).toBe('/api/v1/assistant/drafting-sessions/12/steps/2/propose-again');
    expect(
      toUrl(draftingSessionEndpoints.manual, { sessionId: 12, step: 1 }),
    ).toBe('/api/v1/assistant/drafting-sessions/12/steps/1/manual');
    expect(toUrl(draftingSessionEndpoints.stop, { sessionId: 12 })).toBe(
      '/api/v1/assistant/drafting-sessions/12/stop',
    );
  });

  it('is answered by the backend, the mock only standing in for specs', () => {
    for (const endpoint of Object.values(draftingSessionEndpoints)) {
      expect(endpoint.served, endpoint.path).toBeUndefined();
    }
    expect(draftingSessionEndpoints.start.encoding).toBe('multipart');
    expect(draftingSessionEndpoints.uploadSource.encoding).toBe('multipart');
  });

  it('answers a course without a session with null', () => {
    expect(draftingSessionEndpoints.forCourse.response.parse(null)).toBeNull();
  });
});
