import type { BasicsProposal, DraftingStep } from '@lms/contracts';
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
});
