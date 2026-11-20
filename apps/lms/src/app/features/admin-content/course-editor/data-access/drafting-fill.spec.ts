import type {
  BasicsProposal,
  DraftingStep,
  OutlineProposal,
  RulesProposal,
} from '@lms/contracts';
import { emptyDraftValue, type CourseDraftValue } from '../course-draft';
import { FillPlayer } from './drafting-fill-player';
import {
  DRAFTING_FIELD_DELAY_MS,
  fieldPatch,
  fillSteps,
  markedFields,
  writtenOf,
  type AudiencePatch,
  type FillPatch,
  type RulesPatch,
} from './drafting-fill';
import { emptyRules, type DraftRulesValue } from './drafting-rules';

const proposal: BasicsProposal = {
  title: 'Quy trình đối soát cuối ngày',
  summary: 'Các bước đối soát giao dịch cuối ngày.',
  objectives: ['Nắm các bước đối soát', 'Xử lý chênh lệch'],
  level: 'basic',
  defaultRequirement: 'optional',
  programId: 3,
  moduleId: 4,
  code: 'AI-7K2M9QXA',
  unsure: [],
};

const stepOne = (patch: Partial<BasicsProposal> = {}): DraftingStep => ({
  step: 1,
  state: 'proposed',
  proposal: { ...proposal, ...patch },
  notes: [],
  error: null,
  updateTime: '2026-11-17T09:00:00+07:00',
});

/** The values the form holds after each patch, in order. */
const frames = (step: DraftingStep): CourseDraftValue[] => {
  let value = emptyDraftValue();
  return fillSteps(step)
    .filter((patch): patch is FillPatch => 'apply' in patch)
    .map((patch) => (value = patch.apply(value)));
};

describe('markedFields', () => {
  it('marks a field while it holds what the assistant wrote', () => {
    const value = { ...emptyDraftValue(), title: 'Đối soát', summary: 'Sửa' };
    const written = {
      title: writtenOf(fieldPatch('title', 'Đối soát')),
      summary: writtenOf(fieldPatch('summary', 'Gốc')),
    };

    expect([...markedFields(value, written)]).toEqual(['title']);
  });
});

describe('FillPlayer', () => {
  afterEach(() => vi.useRealTimers());

  it('writes the first patch at once and the rest one delay apart, then says it is done', () => {
    vi.useFakeTimers();
    const player = new FillPlayer();
    const written: string[] = [];
    const done = vi.fn();
    const patches = [fieldPatch('title', 'A'), fieldPatch('summary', 'B')];

    player.play(patches, (patch) => written.push(patch.field), done);
    expect(written).toEqual(['title']);
    expect(done).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DRAFTING_FIELD_DELAY_MS);
    expect(written).toEqual(['title', 'summary']);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('writes nothing more once cancelled', () => {
    vi.useFakeTimers();
    const player = new FillPlayer();
    const written: string[] = [];
    player.play(
      [fieldPatch('title', 'A'), fieldPatch('summary', 'B')],
      (patch) => written.push(patch.field),
      () => undefined,
    );

    player.cancel();
    vi.advanceTimersByTime(DRAFTING_FIELD_DELAY_MS * 3);

    expect(written).toEqual(['title']);
  });
});

describe('fillSteps', () => {
  it('writes step 1 one field at a time, in the order the page shows them', () => {
    expect(fillSteps(stepOne()).map((patch) => patch.field)).toEqual([
      'title',
      'programId',
      'moduleId',
      'code',
      'level',
      'defaultRequirement',
      'summary',
      'objectives',
      'objectives',
    ]);
  });

  it('adds the objectives one item at a time', () => {
    const objectives = frames(stepOne()).map((value) => value.objectives);

    expect(objectives.at(-2)).toEqual(['Nắm các bước đối soát']);
    expect(objectives.at(-1)).toEqual([
      'Nắm các bước đối soát',
      'Xử lý chênh lệch',
    ]);
  });

  it('ends with the whole proposal in the form, ids as select values', () => {
    expect(frames(stepOne()).at(-1)).toMatchObject({
      title: 'Quy trình đối soát cuối ngày',
      summary: 'Các bước đối soát giao dịch cuối ngày.',
      programId: '3',
      moduleId: '4',
      code: 'AI-7K2M9QXA',
      level: 'basic',
      defaultRequirement: 'optional',
    });
  });

  it('leaves an empty programme, module, level or kind as the form has it', () => {
    const step = stepOne({
      programId: null,
      moduleId: null,
      level: null,
      defaultRequirement: null,
    });

    expect(fillSteps(step).map((patch) => patch.field)).not.toEqual(
      expect.arrayContaining(['programId']),
    );
    expect(frames(step).at(-1)).toMatchObject({
      programId: '',
      moduleId: '',
      level: '',
      defaultRequirement: emptyDraftValue().defaultRequirement,
    });
  });

  it('replaces objectives the form already had instead of adding to them', () => {
    let value: CourseDraftValue = {
      ...emptyDraftValue(),
      objectives: ['Cũ'],
    };
    for (const patch of fillSteps(stepOne()))
      if ('apply' in patch) value = patch.apply(value);

    expect(value.objectives).toEqual([
      'Nắm các bước đối soát',
      'Xử lý chênh lệch',
    ]);
  });

  it('writes only the code of a code-only proposal (a new code after a taken one)', () => {
    const codeOnly: DraftingStep = {
      step: 1,
      state: 'manual',
      proposal: { code: 'KH-0042' },
      notes: [],
      error: null,
      updateTime: '2026-11-17T09:00:00+07:00',
    };
    const patches = fillSteps(codeOnly);

    expect(patches.map((patch) => patch.field)).toEqual(['code']);
  });

  it('writes nothing for a step without a proposal', () => {
    expect(
      fillSteps({ ...stepOne(), state: 'proposing', proposal: null }),
    ).toEqual([]);
  });

  describe('step 2', () => {
    const outline: OutlineProposal = {
      chapters: [
        {
          title: 'Tổng quan',
          lessons: [
            {
              title: 'Mục đích',
              description: 'Vì sao đối soát.',
              sourceSection: 'Mục 1',
            },
            {
              title: 'Dữ liệu',
              description: 'Các nguồn dữ liệu.',
              sourceSection: 'Mục 2',
            },
          ],
        },
        {
          title: 'Thực hiện',
          lessons: [
            {
              title: 'Các bước',
              description: 'Thứ tự các bước.',
              sourceSection: 'Mục 3',
            },
          ],
        },
      ],
    };
    const stepTwo: DraftingStep = {
      step: 2,
      state: 'proposed',
      proposal: outline,
      lessonNotes: null,
      notes: [],
      error: null,
      updateTime: '2026-11-17T09:05:00+07:00',
    };

    it('writes each chapter, then its lessons, one at a time', () => {
      const shape = frames(stepTwo).map((value) =>
        value.chapters.map(
          (chapter) =>
            `${chapter.title}:${chapter.lessons.map((l) => l.title).join(',')}`,
        ),
      );

      expect(
        fillSteps(stepTwo).every((patch) => patch.field === 'chapters'),
      ).toBe(true);
      expect(shape).toEqual([
        ['Tổng quan:'],
        ['Tổng quan:Mục đích'],
        ['Tổng quan:Mục đích,Dữ liệu'],
        ['Tổng quan:Mục đích,Dữ liệu', 'Thực hiện:'],
        ['Tổng quan:Mục đích,Dữ liệu', 'Thực hiện:Các bước'],
      ]);
    });

    it('writes lessons without content and keeps their keys from frame to frame', () => {
      const all = frames(stepTwo);
      const last = all[all.length - 1];
      const lessons = last.chapters.flatMap((chapter) => chapter.lessons);

      expect(lessons.every((lesson) => lesson.blocks.length === 0)).toBe(true);
      expect(lessons.every((lesson) => lesson.lessonType === 'content')).toBe(
        true,
      );
      expect(all[1].chapters[0].lessons[0].key).toBe(
        last.chapters[0].lessons[0].key,
      );
      expect(all[0].chapters[0].key).toBe(last.chapters[0].key);
    });

    it("carries each lesson's line and source by the row key it writes", () => {
      const patches = fillSteps(stepTwo).filter(
        (patch): patch is FillPatch => 'apply' in patch,
      );
      const final = patches[patches.length - 1];
      const first = final.apply(emptyDraftValue()).chapters[0].lessons[0];

      expect(final.notes?.[first.key]).toEqual({
        text: 'Vì sao đối soát. · Nguồn: Mục 1',
        suggested: true,
      });
      expect(Object.keys(final.notes ?? {})).toHaveLength(3);
    });

    it('replaces chapters the form already had', () => {
      let value: CourseDraftValue = {
        ...emptyDraftValue(),
        chapters: [{ key: 'old', title: 'Cũ', lessons: [] }],
      };
      for (const patch of fillSteps(stepTwo))
        if ('apply' in patch) value = patch.apply(value);

      expect(value.chapters.map((chapter) => chapter.title)).toEqual([
        'Tổng quan',
        'Thực hiện',
      ]);
    });
  });

  describe('step 3', () => {
    const rules: RulesProposal = {
      rewardPoints: 30,
      competencyId: 7,
      questions: [
        {
          type: 'SINGLE',
          content: 'Đối soát khi nào?',
          explanation: 'Theo mục 3.',
          difficulty: 'EASY',
          options: [
            { content: 'Sau khóa sổ', correct: true },
            { content: 'Trước giờ mở', correct: false },
          ],
          sourceSection: 'Mục 3',
        },
        {
          type: 'MULTIPLE',
          content: 'Nguồn dữ liệu?',
          explanation: null,
          difficulty: 'MEDIUM',
          options: [
            { content: 'Sổ cái', correct: true },
            { content: 'Báo cáo kênh', correct: true },
          ],
          sourceSection: 'Mục 2',
        },
      ],
    };
    const stepThree = (patch: Partial<RulesProposal> = {}): DraftingStep => ({
      step: 3,
      state: 'proposed',
      proposal: { ...rules, ...patch },
      notes: [],
      error: null,
      updateTime: '2026-11-17T09:10:00+07:00',
    });
    const rulesFrames = (step: DraftingStep): DraftRulesValue[] => {
      let value = emptyRules();
      return fillSteps(step)
        .filter((patch): patch is RulesPatch => 'rules' in patch)
        .map((patch) => (value = patch.rules(value)));
    };

    it('writes the points, the competency, then the questions one at a time', () => {
      expect(fillSteps(stepThree()).map((patch) => patch.field)).toEqual([
        'rewardPoints',
        'competencyId',
        'questions',
        'questions',
      ]);
      expect(frames(stepThree()).at(-1)?.rewardPoints).toBe(30);
      const shown = rulesFrames(stepThree());
      expect(shown.map((value) => value.questions.length)).toEqual([0, 1, 2]);
      expect(shown.at(-1)?.competencyId).toBe('7');
      expect(shown[1].questions[0].key).toBe(shown[2].questions[0].key);
    });

    it('keeps each question with its options, explanation and source section', () => {
      const [first, second] = rulesFrames(stepThree()).at(-1)?.questions ?? [];

      expect(first).toMatchObject({
        content: 'Đối soát khi nào?',
        explanation: 'Theo mục 3.',
        difficulty: 'EASY',
        sourceSection: 'Mục 3',
      });
      expect(first.options.map((o) => [o.content, o.correct])).toEqual([
        ['Sau khóa sổ', true],
        ['Trước giờ mở', false],
      ]);
      expect(second.explanation).toBe('');
    });

    it('leaves the competency empty when the assistant did not pick one', () => {
      const step = stepThree({ competencyId: null });

      expect(fillSteps(step).map((patch) => patch.field)).not.toContain(
        'competencyId',
      );
      expect(rulesFrames(step).at(-1)?.competencyId).toBe('');
    });
  });

  describe('step 4, the audience', () => {
    const stepFour: Extract<DraftingStep, { step: 4 }> = {
      step: 4,
      state: 'proposed',
      proposal: {
        targets: [
          {
            targetType: 'org',
            orgId: 2,
            includeDescendants: true,
            label: 'Khối Vận hành',
          },
          {
            targetType: 'team',
            teamId: 5,
            includeDescendants: false,
            label: 'Tổ giao dịch viên',
          },
        ],
        publishBlockers: ['2 bài chưa có nội dung'],
      },
      notes: [],
      error: null,
      updateTime: '2026-11-17T09:20:00+07:00',
    };

    it('writes the assign rows one target at a time and nothing into the draft', () => {
      const patches = fillSteps(stepFour);

      expect(patches.map((patch) => patch.field)).toEqual([
        'targets',
        'targets',
      ]);
      expect(patches.every((patch) => 'picks' in patch)).toBe(true);
      const picks = (patches as AudiencePatch[]).map((patch) =>
        patch.picks.map((pick) => pick.label),
      );
      expect(picks).toEqual([
        ['Khối Vận hành'],
        ['Khối Vận hành', 'Tổ giao dịch viên'],
      ]);
      expect((patches.at(-1) as AudiencePatch).picks[0]).toEqual(
        stepFour.proposal?.targets[0],
      );
    });

    it('writes nothing when the assistant proposed no target', () => {
      expect(
        fillSteps({
          ...stepFour,
          proposal: { targets: [], publishBlockers: [] },
        }),
      ).toEqual([]);
    });
  });
});
