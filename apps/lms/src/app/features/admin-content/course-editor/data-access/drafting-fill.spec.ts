import type {
  BasicsProposal,
  DraftingStep,
  OutlineProposal,
} from '@lms/contracts';
import { emptyDraftValue, type CourseDraftValue } from '../course-draft';
import { fillSteps } from './drafting-fill';

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
  return fillSteps(step).map((patch) => (value = patch.apply(value)));
};

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
    for (const patch of fillSteps(stepOne())) value = patch.apply(value);

    expect(value.objectives).toEqual([
      'Nắm các bước đối soát',
      'Xử lý chênh lệch',
    ]);
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

    it('replaces chapters the form already had', () => {
      let value: CourseDraftValue = {
        ...emptyDraftValue(),
        chapters: [{ key: 'old', title: 'Cũ', lessons: [] }],
      };
      for (const patch of fillSteps(stepTwo)) value = patch.apply(value);

      expect(value.chapters.map((chapter) => chapter.title)).toEqual([
        'Tổng quan',
        'Thực hiện',
      ]);
    });
  });
});
