import type {
  AudienceProposal,
  BasicsProposal,
  DraftingSession,
  DraftingStep,
  DraftingStepNumber,
  OutlineProposal,
  RulesProposal,
} from '@lms/contracts';

// What the backend's drafting session proposes for one source document, step by step. The
// proposals are fixed results: the model and the server's id checks are the backend's.

export const DRAFTING_FIXTURE_TIME = '2026-11-17T09:00:00+07:00';

export const basicsProposalFixture: BasicsProposal = {
  title: 'Quy trình đối soát cuối ngày',
  summary:
    'Khóa học hướng dẫn giao dịch viên các bước đối soát giao dịch cuối ngày và xử lý chênh lệch.',
  objectives: [
    'Nắm các bước đối soát cuối ngày',
    'Xử lý chênh lệch đúng quy trình',
  ],
  level: 'basic',
  defaultRequirement: 'mandatory',
  programId: 1,
  moduleId: null,
  code: 'AI-7K2M9QXA',
  unsure: ['moduleId'],
};

export const outlineProposalFixture: OutlineProposal = {
  chapters: [
    {
      title: 'Tổng quan đối soát',
      lessons: [
        {
          title: 'Mục đích của đối soát',
          description: 'Vì sao phải đối soát giao dịch mỗi ngày.',
          sourceSection: 'Mục 1. Giới thiệu',
        },
        {
          title: 'Các nguồn dữ liệu',
          description: 'Sổ cái, báo cáo kênh và bảng kê giao dịch.',
          sourceSection: 'Mục 2. Dữ liệu đối soát',
        },
      ],
    },
    {
      title: 'Thực hiện đối soát',
      lessons: [
        {
          title: 'Các bước thực hiện',
          description: 'Thứ tự các bước từ khóa sổ đến ký xác nhận.',
          sourceSection: 'Mục 3. Quy trình',
        },
        {
          title: 'Xử lý chênh lệch',
          description: 'Ghi nhận, báo cáo và theo dõi chênh lệch.',
          sourceSection: 'Mục 4. Xử lý ngoại lệ',
        },
      ],
    },
  ],
};

export const rulesProposalFixture: RulesProposal = {
  rewardPoints: 10,
  competencyId: null,
  questions: [
    {
      type: 'SINGLE',
      content: 'Đối soát cuối ngày được thực hiện khi nào?',
      explanation: 'Theo mục 3 của tài liệu nguồn.',
      difficulty: 'EASY',
      options: [
        { content: 'Sau khi khóa sổ giao dịch', correct: true },
        { content: 'Trước khi mở quầy', correct: false },
      ],
      sourceSection: 'Mục 3. Quy trình',
    },
    {
      type: 'MULTIPLE',
      content: 'Những nguồn dữ liệu nào dùng để đối soát?',
      explanation: null,
      difficulty: 'MEDIUM',
      options: [
        { content: 'Sổ cái', correct: true },
        { content: 'Báo cáo kênh', correct: true },
        { content: 'Lịch làm việc', correct: false },
      ],
      sourceSection: 'Mục 2. Dữ liệu đối soát',
    },
  ],
};

export const audienceProposalFixture: AudienceProposal = {
  targets: [
    {
      targetType: 'org',
      orgId: 2,
      includeDescendants: true,
      label: 'Khối Vận hành',
    },
  ],
  // What the server's pre-publish check lists: the page's draftChecks labels and a lesson count.
  publishBlockers: [
    'Mọi bài học có nội dung, đủ tệp hoặc đã chọn bài kiểm tra',
    '4 bài chưa có nội dung',
  ],
};

/** One reached step with the given state; a `proposing` step has no proposal yet. */
export function draftingStepFixture(
  step: DraftingStepNumber,
  state: DraftingStep['state'] = 'proposed',
): DraftingStep {
  const base = {
    state,
    notes: [] as string[],
    error: null,
    updateTime: DRAFTING_FIXTURE_TIME,
  };
  const has = state !== 'proposing' && state !== 'manual';
  switch (step) {
    case 1:
      return {
        ...base,
        step,
        proposal: has ? basicsProposalFixture : null,
        notes: has ? ['Chưa chọn được mô-đun, hãy kiểm tra.'] : [],
      };
    case 2:
      return {
        ...base,
        step,
        proposal: has ? outlineProposalFixture : null,
        lessonNotes: null,
      };
    case 3:
      return { ...base, step, proposal: has ? rulesProposalFixture : null };
    case 4:
      return { ...base, step, proposal: has ? audienceProposalFixture : null };
  }
}

/**
 * A session whose `step` is proposed and the earlier steps confirmed; the course exists from
 * step 2 on.
 */
export function draftingSessionFixture(
  step: DraftingStepNumber,
): DraftingSession {
  const steps = ([1, 2, 3, 4] as const)
    .filter((n) => n <= step)
    .map((n) => draftingStepFixture(n, n < step ? 'confirmed' : 'proposed'));
  return {
    id: 1,
    status: 'active',
    currentStep: step,
    courseId: step > 1 ? 501 : null,
    revisionId: step > 1 ? 601 : null,
    conversationId: null,
    source: {
      documentId: 40,
      fileName: 'quy-trinh-doi-soat.pdf',
      status: 'ready',
    },
    error: null,
    steps,
    createTime: DRAFTING_FIXTURE_TIME,
    updateTime: DRAFTING_FIXTURE_TIME,
  };
}
