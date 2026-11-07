import { Component, computed, input, output } from '@angular/core';
import type { SessionQuestion } from '@lms/contracts';
import {
  Alert,
  Button,
  Card,
  Icon,
  OptionCard,
  Progress,
  Timer,
} from '@lms/ui';
import { QuestionGrid } from '../../../../../../shared/quiz/question-grid';
import { QuestionLegend } from '../../../../../../shared/quiz/question-legend';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * The quiz in progress (the mockup's `quizTake`): the question on screen, the navigator and the
 * countdown. It holds no state; the take store owns the answers and the clock. The question's
 * bank code, when it has one, follows "Câu n / N".
 */
@Component({
  selector: 'app-assessment-take',
  imports: [
    Alert,
    Button,
    Card,
    Icon,
    OptionCard,
    Progress,
    QuestionGrid,
    QuestionLegend,
    Timer,
  ],
  templateUrl: './assessment-take.html',
  styleUrl: './assessment-take.scss',
})
export class AssessmentTake {
  readonly quizTitle = input.required<string>();
  readonly questions = input.required<readonly SessionQuestion[]>();
  /** Zero-based index of the question on screen. */
  readonly current = input.required<number>();
  /** Seconds left on the server's clock. */
  readonly seconds = input.required<number>();
  readonly saving = input(false);
  readonly submitting = input(false);
  /** The server's message when a choice could not be saved; shown with "Thử lại". */
  readonly saveError = input<string>();
  readonly focusPolicy = input.required<{
    readonly count: number;
    readonly limit: number;
    readonly locked: boolean;
    readonly submitError?: string;
  }>();
  readonly retrySave = output<void>();
  readonly retrySubmit = output<void>();
  readonly answerSelected = output<{
    questionId: number;
    optionId: number;
    checked: boolean;
  }>();
  readonly flagged = output<number>();
  readonly goto = output<number>();
  readonly submitted = output<void>();
  protected readonly answersLocked = computed(
    () => this.submitting() || this.focusPolicy().locked,
  );

  protected readonly question = computed(
    () => this.questions()[this.current()],
  );
  /** The options of the question on screen, each with its letter and whether it is chosen. */
  protected readonly options = computed(() => {
    const question = this.question();
    return (question?.options ?? []).map((option, i) => ({
      id: option.id,
      content: option.content,
      letter: LETTERS[i],
      selected: question?.selectedOptionIds.includes(option.id) ?? false,
    }));
  });
  protected readonly answeredCount = computed(
    () => this.questions().filter((q) => q.selectedOptionIds.length).length,
  );
  protected readonly cells = computed(() =>
    this.questions().map((q) => ({
      answered: q.selectedOptionIds.length > 0,
      flagged: q.flagged,
    })),
  );

  protected select(event: Event, questionId: number, optionId: number): void {
    this.answerSelected.emit({
      questionId,
      optionId,
      checked: (event.target as HTMLInputElement).checked,
    });
  }
}
