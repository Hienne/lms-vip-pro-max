import { Component, inject } from '@angular/core';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Icon,
  Input,
  SectionCard,
  Select,
  Textarea,
} from '@lms/ui';
import { DraftingFillStore } from '../../../../data-access/drafting-fill.store';
import type {
  DraftOptionValue,
  DraftQuestionValue,
} from '../../../../data-access/drafting-rules';

const DIFFICULTY: Record<DraftQuestionValue['difficulty'], string> = {
  EASY: 'Dễ',
  MEDIUM: 'Trung bình',
  HARD: 'Khó',
};

/**
 * Step 3 of a drafting session: the draft questions the assistant proposed for the final exam,
 * each with the part of the document it comes from, and their competency. The author edits or
 * removes them; they reach the question bank only when the step is confirmed, as a new final
 * exam of the kept questions. The state is {@link DraftingFillStore}'s.
 */
@Component({
  selector: 'app-drafting-questions',
  imports: [
    Badge,
    Button,
    Checkbox,
    Field,
    Icon,
    Input,
    SectionCard,
    Select,
    Textarea,
  ],
  templateUrl: './drafting-questions.html',
  styleUrl: './drafting-questions.scss',
})
export class DraftingQuestions {
  protected readonly fill = inject(DraftingFillStore);
  protected readonly difficulty = DIFFICULTY;

  protected chooseCompetency(event: Event): void {
    this.fill.setCompetency((event.target as HTMLSelectElement).value);
  }

  protected editContent(question: DraftQuestionValue, event: Event): void {
    this.fill.updateQuestion({
      ...question,
      content: (event.target as HTMLTextAreaElement).value,
    });
  }

  protected editExplanation(question: DraftQuestionValue, event: Event): void {
    this.fill.updateQuestion({
      ...question,
      explanation: (event.target as HTMLTextAreaElement).value,
    });
  }

  protected editOption(
    question: DraftQuestionValue,
    option: DraftOptionValue,
    change: Partial<DraftOptionValue>,
  ): void {
    this.fill.updateQuestion({
      ...question,
      options: question.options.map((item) =>
        item.key === option.key ? { ...item, ...change } : item,
      ),
    });
  }

  protected optionText(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected optionCorrect(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }
}
