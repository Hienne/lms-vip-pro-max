import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  applyEach,
  form,
  FormField,
  required,
  validate,
} from '@angular/forms/signals';
import {
  Button,
  Checkbox,
  Field,
  Icon,
  Input,
  SectionCard,
  Select,
  Textarea,
} from '@lms/ui';
import type { RulesCommand } from '../../../../data-access/drafting-fill.store';
import { DraftingQuestionsStore } from '../../../../data-access/drafting-questions.store';
import {
  rulesProblem,
  toConfirmQuestions,
  type DraftQuestionValue,
  type DraftRulesValue,
} from '../../../../data-access/drafting-rules';
import { SuggestedMark } from '../../../suggested-mark/suggested-mark';

const DIFFICULTY: Record<DraftQuestionValue['difficulty'], string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

/**
 * Step 3 of a drafting session: the draft questions the assistant proposed for the final exam,
 * each with the part of the document it comes from, and their competency. The author edits or
 * removes them in this card's own form, which starts from (and is replaced by) what the assistant
 * writes; the kept questions reach the question bank only when the step is confirmed, as a new
 * final exam, through {@link command}.
 */
@Component({
  selector: 'app-drafting-questions',
  imports: [
    Button,
    Checkbox,
    Field,
    FormField,
    Icon,
    Input,
    SectionCard,
    Select,
    SuggestedMark,
    Textarea,
  ],
  templateUrl: './drafting-questions.html',
  styleUrl: './drafting-questions.scss',
})
export class DraftingQuestions {
  protected readonly store = inject(DraftingQuestionsStore);
  protected readonly difficulty = DIFFICULTY;

  private readonly model = linkedSignal<DraftRulesValue>(() =>
    this.store.proposed$(),
  );
  protected readonly questionsForm = form(this.model, (path) => {
    validate(path.competencyId, ({ value, valueOf }) =>
      valueOf(path.questions).length > 0 && !value()
        ? {
            kind: 'required',
            message: 'Chọn năng lực cho các câu hỏi trước khi chốt.',
          }
        : undefined,
    );
    applyEach(path.questions, (question) => {
      required(question.content, { message: 'Nhập nội dung câu hỏi.' });
    });
  });

  /** The competency still holds what the assistant picked. */
  protected readonly competencyMarked = computed(() =>
    this.store.competencyMarked(this.model()),
  );
  /** The questions the author has not changed since the assistant wrote them. */
  protected readonly questionMarks = computed(() =>
    this.store.questionMarks(this.model()),
  );

  /** Why the kept questions cannot become the final exam yet; null when they can. */
  readonly problem = computed(() => rulesProblem(this.model()));

  constructor() {
    this.store.showList();
  }

  /** What "Đã chốt" on step 3 sends beside the draft; null while {@link problem} says why not. */
  command(): RulesCommand | null {
    const rules = this.model();
    if (rulesProblem(rules) !== null) return null;
    return {
      competencyId: rules.competencyId ? Number(rules.competencyId) : null,
      questions: toConfirmQuestions(rules),
    };
  }

  /** "Bỏ câu hỏi": the question is not created when the step is confirmed. */
  protected remove(key: string): void {
    this.model.update((rules) => ({
      ...rules,
      questions: rules.questions.filter((question) => question.key !== key),
    }));
  }
}
