import { computed, inject, Injectable, signal } from '@angular/core';
import {
  assessmentV1Endpoints as api,
  type QuizAttemptGrantRequest,
} from '@lms/contracts';
import { serverData } from '../../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../../../core/http/endpoint-client';

export const EXHAUSTED_LEARNER_PAGE_SIZE = 10;

@Injectable()
export class QuizAttemptGrantStore {
  private readonly client = inject(EndpointClient);
  private readonly quizId = signal<number | undefined>(undefined);
  private readonly search = signal('');
  private readonly page = signal(1);

  private readonly learnerData = serverData(
    ({
      quizId,
      userId,
      page,
    }: {
      quizId: number;
      userId: string;
      page: number;
    }) =>
      this.client.call(api.exhaustedLearners, {
        params: { quizId },
        query: {
          userId: userId || undefined,
          page: page - 1,
          size: EXHAUSTED_LEARNER_PAGE_SIZE,
        },
      }),
    {
      params: () => {
        const quizId = this.quizId();
        return quizId === undefined
          ? undefined
          : { quizId, userId: this.search(), page: this.page() };
      },
    },
  );

  private readonly grantMutation = serverMutation(
    ({ quizId, body }: { quizId: number; body: QuizAttemptGrantRequest }) =>
      this.client.call(api.grantExhaustedLearnerAttempts, {
        params: { quizId },
        query: { requireExhausted: true },
        body,
      }),
    {
      errors: 'alert',
      onSuccess: () => this.close(),
      success: (_, grant) => ({
        title: 'Đã cấp thêm lượt thi',
        detail: `${grant.userName ?? grant.userId} được cấp thêm ${grant.extraAttempts} lượt.`,
      }),
    },
  );

  readonly open$ = computed(() => this.quizId() !== undefined);
  readonly search$ = this.search.asReadonly();
  readonly page$ = this.page.asReadonly();
  readonly learners$ = this.learnerData.value;
  readonly loadError$ = this.learnerData.error;
  readonly saveError$ = this.grantMutation.error;
  readonly busy$ = this.grantMutation.isPending;

  open(quizId: number): void {
    this.search.set('');
    this.page.set(1);
    this.grantMutation.reset();
    this.quizId.set(quizId);
  }

  close(): void {
    this.quizId.set(undefined);
  }

  setSearch(query: string): void {
    this.search.set(query.trim().slice(0, 20));
    this.setPage(1);
  }

  setPage(page: number): void {
    this.page.set(page);
    this.grantMutation.reset();
  }

  reload(): void {
    this.setPage(1);
    this.learnerData.reload();
  }

  grant(body: QuizAttemptGrantRequest): void {
    const quizId = this.quizId();
    if (
      quizId === undefined ||
      this.busy$() ||
      !this.learners$()?.items.some((learner) => learner.userId === body.userId)
    )
      return;
    this.grantMutation.run({ quizId, body });
  }
}
