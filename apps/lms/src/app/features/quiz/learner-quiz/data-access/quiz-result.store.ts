import { inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { learnerQuizEndpoints } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { routeId } from './route-id';

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

  setReviewOpen(open: boolean): void {
    this.state.reviewOpen.set(open);
  }

  retry(): void {
    this.resultData.reload();
  }
}
