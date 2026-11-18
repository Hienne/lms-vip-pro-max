import type { DraftQuestion } from '@lms/contracts';
import {
  emptyRules,
  rulesProblem,
  toConfirmQuestions,
  toQuestionValue,
  type DraftRulesValue,
} from './drafting-rules';

const single: DraftQuestion = {
  type: 'SINGLE',
  content: 'Đối soát khi nào?',
  explanation: 'Theo mục 3.',
  difficulty: 'EASY',
  options: [
    { content: 'Sau khóa sổ', correct: true },
    { content: 'Trước giờ mở', correct: false },
  ],
  sourceSection: 'Mục 3',
};

const rules = (
  questions: readonly DraftQuestion[],
  competencyId = '7',
): DraftRulesValue => ({
  competencyId,
  questions: questions.map(toQuestionValue),
});

describe('drafting rules', () => {
  it('sends the kept questions back in the proposal shape, the type from the correct options', () => {
    const value = rules([single]);
    const edited: DraftRulesValue = {
      ...value,
      questions: [
        {
          ...value.questions[0],
          content: '  Đối soát lúc nào?  ',
          explanation: ' ',
          options: value.questions[0].options.map((option) => ({
            ...option,
            correct: true,
          })),
        },
      ],
    };

    expect(toConfirmQuestions(edited)).toEqual([
      {
        type: 'MULTIPLE',
        content: 'Đối soát lúc nào?',
        explanation: null,
        difficulty: 'EASY',
        options: [
          { content: 'Sau khóa sổ', correct: true },
          { content: 'Trước giờ mở', correct: true },
        ],
        sourceSection: 'Mục 3',
      },
    ]);
    expect(toConfirmQuestions(value)[0].type).toBe('SINGLE');
  });

  it('asks for a competency only while questions are kept', () => {
    expect(rulesProblem(rules([single], ''))).toBe(
      'Chọn năng lực cho các câu hỏi trước khi chốt.',
    );
    expect(rulesProblem(rules([], ''))).toBeNull();
    expect(rulesProblem(emptyRules())).toBeNull();
    expect(rulesProblem(rules([single]))).toBeNull();
  });

  it('names the first question without text or a correct option', () => {
    const value = rules([single, single]);
    const noText: DraftRulesValue = {
      ...value,
      questions: [value.questions[0], { ...value.questions[1], content: ' ' }],
    };
    const noCorrect: DraftRulesValue = {
      ...value,
      questions: [
        {
          ...value.questions[0],
          options: value.questions[0].options.map((option) => ({
            ...option,
            correct: false,
          })),
        },
      ],
    };
    const emptyOption: DraftRulesValue = {
      ...value,
      questions: [
        {
          ...value.questions[0],
          options: [{ ...value.questions[0].options[0], content: '' }],
        },
      ],
    };

    expect(rulesProblem(noText)).toBe('Câu hỏi 2 chưa có nội dung.');
    expect(rulesProblem(noCorrect)).toBe(
      'Câu hỏi 1 cần ít nhất một đáp án đúng.',
    );
    expect(rulesProblem(emptyOption)).toBe(
      'Câu hỏi 1 cần ít nhất hai phương án, mỗi phương án có nội dung.',
    );
  });
});
