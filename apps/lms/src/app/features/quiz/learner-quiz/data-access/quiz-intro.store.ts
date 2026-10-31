import { Dialog } from '@angular/cdk/dialog';
import { computed, inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { learnerQuizEndpoints, type LearnerReviewPolicy } from '@lms/contracts';
import { confirm } from '@lms/ui';
import { firstValueFrom } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { blockReasonText } from '../../../../shared/quiz/quiz-block-reason';
import { routeId } from './route-id';

export type QuizIntroView = 'loading' | 'missing' | 'ready';

const REVIEW_TEXT: Record<LearnerReviewPolicy, string> = {
  NEVER: 'Không cho xem đáp án',
  AFTER_SUBMIT: 'Xem đáp án và giải thích ngay sau khi nộp',
  AFTER_PASS: 'Xem đáp án khi đã đạt',
  AFTER_CLOSE: 'Xem đáp án sau khi đóng đề',
};

/**
 * The screen before a quiz. What the learner may do (`canStart`, `blockReason`, the attempts
 * left) is the server's answer; the store words it and, on "start", leaves for the take screen,
 * which asks the server for the attempt.
 */
@Injectable()
export class QuizIntroStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  readonly quizId$ = routeId(this.route, 'id');

  private readonly introData = serverData(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.quizIntro, { params: { quizId } }),
    { params: () => this.quizId$() },
  );

  readonly intro$ = this.introData.value;
  readonly loadError$ = this.introData.error;

  readonly view$ = computed((): QuizIntroView => {
    if (this.quizId$() === undefined) return 'missing';
    return this.intro$() ? 'ready' : 'loading';
  });

  /** An attempt the learner left running: "start" continues it and costs no new attempt. */
  readonly resuming$ = computed(
    () => this.intro$()?.summary.runningAttemptId != null,
  );

  /** The server's reason the learner cannot start, in a sentence; `null` when they can. */
  readonly blockText$ = computed((): string | null => {
    const intro = this.intro$();
    if (!intro?.blockReason) return null;
    return blockReasonText(intro.blockReason, {
      availableAt: intro.availableAt,
      closeAt: intro.quiz.closeAt,
    });
  });

  readonly reviewText$ = computed(() => {
    const policy = this.intro$()?.quiz.reviewPolicy;
    return policy ? REVIEW_TEXT[policy] : '';
  });

  /** The attempt about to start, out of the attempts allowed, e.g. "2/3". */
  readonly attemptNo$ = computed(() => {
    const summary = this.intro$()?.summary;
    return summary ? summary.attemptsUsed + 1 : 0;
  });

  retry(): void {
    this.introData.reload();
  }

  async start(): Promise<void> {
    const intro = this.intro$();
    if (!intro?.canStart) return;
    if (
      !this.resuming$() &&
      !(await firstValueFrom(
        confirm(this.dialog, {
          title: 'Bắt đầu làm bài?',
          message: `Bạn có ${intro.quiz.timeLimitMinutes} phút cho ${intro.quiz.questionCount} câu. Lượt thi được tính khi bắt đầu.`,
          confirmLabel: 'Bắt đầu',
        }),
      ))
    )
      return;
    await this.router.navigate(['/quiz', intro.quiz.id, 'take']);
  }
}
