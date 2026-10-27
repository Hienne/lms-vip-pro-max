import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Button,
  Card,
  Empty,
  Icon,
  OptionCard,
  Progress,
  Timer,
} from '@lms/ui';
import type { AttemptSnapshot } from '@lms/contracts';
import { QuestionGrid } from '../../../../../shared/quiz/question-grid';
import { QuestionLegend } from '../../../../../shared/quiz/question-legend';
@Component({
  selector: 'app-assessment-take',
  imports: [
    RouterLink,
    Alert,
    Button,
    Card,
    Empty,
    Icon,
    OptionCard,
    Progress,
    Timer,
    QuestionGrid,
    QuestionLegend,
  ],
  templateUrl: './assessment-take.html',
  styleUrl: './assessment-take.scss',
})
export class AssessmentTake {
  readonly snapshot = input.required<AttemptSnapshot | undefined | null>();
  readonly quizId = input.required<string>();
  readonly current = input.required<number>();
  readonly seconds = input.required<number>();
  readonly saving = input(false);
  readonly saveError = input<string>();
  readonly retrySave = output<void>();
  readonly answerSelected = output<{
    questionId: string;
    optionId: string;
    checked: boolean;
    multiple: boolean;
  }>();
  readonly flagged = output<string>();
  readonly goto = output<number>();
  readonly submitted = output<void>();
  protected readonly letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  protected readonly question = computed(
    () => this.snapshot()?.questions[this.current()],
  );
  protected readonly answeredCount = computed(
    () =>
      this.snapshot()?.questions.filter(
        (q) => this.snapshot()?.attempt.answers[q.id]?.length,
      ).length ?? 0,
  );
  protected readonly cells = computed(
    () =>
      this.snapshot()?.questions.map((q) => ({
        answered: !!this.snapshot()?.attempt.answers[q.id]?.length,
        flagged: this.snapshot()?.attempt.flags.includes(q.id) ?? false,
      })) ?? [],
  );
}
