import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { learnerQuizEndpoints } from '@lms/contracts';
import { serverData } from '../../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { routeId } from '../../data-access/route-id';

/** The result of one graded attempt, as the server computed it. */
@Injectable()
export class QuizResultStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);

  private readonly state = {
    /** The review starts collapsed. */
    reviewOpen: signal(false),
  };

  readonly attemptId$ = routeId(this.route, 'attemptId');

  private readonly resultData = serverData(
    (attemptId: number) =>
      this.client.call(learnerQuizEndpoints.attemptResult, {
        params: { attemptId },
      }),
    { params: () => this.attemptId$() },
  );

  readonly result$ = this.resultData.value;
  readonly loadError$ = this.resultData.error;
  readonly reviewOpen$ = this.state.reviewOpen.asReadonly();

  // The result has scores and attempt counts; the intro applies the current retake policy.
  private readonly retakeEligibility = serverData(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.quizIntro, { params: { quizId } }),
    {
      params: () => {
        const result = this.result$();
        return result?.summary.everPassed && result.summary.attemptsLeft > 0
          ? result.quizId
          : undefined;
      },
    },
  );

  readonly canRetry$ = computed(() => {
    const summary = this.result$()?.summary;
    if (!summary || summary.attemptsLeft <= 0) return false;
    if (!summary.everPassed) return true;
    const eligibility = this.retakeEligibility.value();
    return (
      eligibility?.canStart === true || eligibility?.blockReason === 'WAIT'
    );
  });

  setReviewOpen(open: boolean): void {
    this.state.reviewOpen.set(open);
  }

  retry(): void {
    this.resultData.reload();
  }
}
