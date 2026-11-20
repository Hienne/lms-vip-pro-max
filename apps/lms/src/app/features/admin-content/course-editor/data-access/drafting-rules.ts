import type { DraftQuestion } from '@lms/contracts';

// Step 3 of a drafting session on the page: the draft questions and their competency. They are
// page state, not part of the course draft: they reach the question bank only when the author
// confirms the step, and then as a new final exam (corebanking-academy `confirmRules`).

export interface DraftOptionValue {
  readonly key: string;
  readonly content: string;
  readonly correct: boolean;
}

/** A draft question as the author edits it; its type follows from how many options are correct. */
export interface DraftQuestionValue {
  readonly key: string;
  readonly content: string;
  /** '' for none. */
  readonly explanation: string;
  readonly difficulty: DraftQuestion['difficulty'];
  readonly options: readonly DraftOptionValue[];
  /** The part of the document the question comes from. */
  readonly sourceSection: string;
}

export interface DraftRulesValue {
  /** A select value: an id, or '' for none. */
  readonly competencyId: string;
  readonly questions: readonly DraftQuestionValue[];
}

export const emptyRules = (): DraftRulesValue => ({
  competencyId: '',
  questions: [],
});

let nextKey = 0;
const key = (): string => `dq${++nextKey}`;

export function toQuestionValue(question: DraftQuestion): DraftQuestionValue {
  return {
    key: key(),
    content: question.content,
    explanation: question.explanation ?? '',
    difficulty: question.difficulty,
    options: question.options.map((option) => ({
      key: key(),
      content: option.content,
      correct: option.correct,
    })),
    sourceSection: question.sourceSection,
  };
}

/** The kept questions as "Đã chốt" sends them: one correct option is SINGLE, more is MULTIPLE. */
export function toConfirmQuestions(rules: DraftRulesValue): DraftQuestion[] {
  return rules.questions.map((question) => ({
    type:
      question.options.filter((option) => option.correct).length > 1
        ? 'MULTIPLE'
        : 'SINGLE',
    content: question.content.trim(),
    explanation: question.explanation.trim() || null,
    difficulty: question.difficulty,
    options: question.options.map((option) => ({
      content: option.content.trim(),
      correct: option.correct,
    })),
    sourceSection: question.sourceSection,
  }));
}

/** Why the kept questions cannot become the final exam yet; null when they can (or none is kept). */
export function rulesProblem(rules: DraftRulesValue): string | null {
  if (rules.questions.length === 0) return null;
  if (!rules.competencyId)
    return 'Chọn năng lực cho các câu hỏi trước khi chốt.';
  for (const [index, question] of rules.questions.entries()) {
    const label = `Câu hỏi ${index + 1}`;
    if (!question.content.trim()) return `${label} chưa có nội dung.`;
    if (
      question.options.length < 2 ||
      question.options.some((option) => !option.content.trim())
    )
      return `${label} cần ít nhất hai phương án, mỗi phương án có nội dung.`;
    if (!question.options.some((option) => option.correct))
      return `${label} cần ít nhất một đáp án đúng.`;
  }
  return null;
}
