import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearnerQuizCard } from '@lms/contracts';
import { Badge, Button, FmtScorePipe, Icon } from '@lms/ui';
import { blockReasonText } from '../quiz-block-reason';

/**
 * One quiz of a course, as the course page and the lesson player list it: what it asks, what the
 * learner has done on it, and the way in. Whether the learner can start is the server's call
 * (`canStart`, `blockReason`); this only words it.
 */
@Component({
  selector: 'app-quiz-card',
  imports: [Badge, Button, FmtScorePipe, Icon, RouterLink],
  templateUrl: './quiz-card.html',
  styleUrl: './quiz-card.scss',
})
export class QuizCard {
  readonly card = input.required<LearnerQuizCard>();
  /** The quiz is the main thing on its screen (a quiz lesson), so its way in is the primary button. */
  readonly primary = input(false);

  protected readonly resuming = computed(
    () => this.card().summary.runningAttemptId !== null,
  );

  protected readonly blockText = computed((): string | null => {
    const { blockReason, availableAt, quiz } = this.card();
    return blockReason
      ? blockReasonText(blockReason, { availableAt, closeAt: quiz.closeAt })
      : null;
  });
}
