import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { learnerQuizEndpoints, type LearnerAttemptRow } from '@lms/contracts';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../../core/files/file-saver';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { routeId } from '../../data-access/route-id';

export const ATTEMPTS_PAGE_SIZE = 10;

export type AttemptOutcome = 'passed' | 'failed' | 'running' | 'voided';

export interface AttemptView {
  /** The data table keys rows by a string. */
  readonly id: string;
  readonly attemptNo: number;
  readonly submittedAt: string | null;
  readonly durationSeconds: number | null;
  /** The server's percentage, `null` until the attempt is graded. */
  readonly score: number | null;
  readonly correct: string;
  readonly outcome: AttemptOutcome;
  /** Submitted by the server when time ran out or the quiz closed, not by the learner. */
  readonly autoSubmitted: boolean;
  /** A graded attempt opens its result; one still running opens the take screen. */
  readonly link: readonly (string | number)[] | null;
}

function outcomeOf(row: LearnerAttemptRow): AttemptOutcome {
  if (row.status === 'IN_PROGRESS') return 'running';
  if (row.status === 'VOIDED') return 'voided';
  return row.passed ? 'passed' : 'failed';
}

/** The history of one quiz: every attempt the learner made, with the server's combined summary. */
@Injectable()
export class QuizAttemptsStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly fileSaver = inject(FileSaver);

  private readonly state = {
    /** The 1-based page of the history table. */
    page: signal(1),
    pageSize: signal(ATTEMPTS_PAGE_SIZE),
  };

  readonly quizId$ = routeId(this.route, 'id');

  private readonly historyData = serverData(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.quizHistory, {
        params: { quizId },
      }),
    { params: () => this.quizId$() },
  );

  private readonly download = serverMutation(
    (quizId: number) =>
      this.client.call(learnerQuizEndpoints.exportAttempts, {
        query: { quizId, sort: 'startedAt,desc' },
      }),
    {
      errors: 'toast',
      onSuccess: (blob) => this.fileSaver.save(blob, 'lich-su-thi.csv'),
    },
  );

  readonly history$ = this.historyData.value;
  readonly loadError$ = this.historyData.error;
  readonly isExporting$ = this.download.isPending;
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize$ = this.state.pageSize.asReadonly();

  /** Newest first, as a learner reads a history. */
  private readonly rows$ = computed((): readonly AttemptView[] => {
    const quizId = this.quizId$();
    const history = this.history$();
    if (!history || quizId === undefined) return [];
    return history.attempts
      .map((row) => {
        const outcome = outcomeOf(row);
        return {
          id: String(row.attemptId),
          attemptNo: row.attemptNo,
          submittedAt: row.submittedAt,
          durationSeconds: row.durationSeconds,
          score: row.scorePercent,
          correct:
            row.correctCount == null
              ? '—'
              : `${row.correctCount}/${row.totalQuestions}`,
          outcome,
          autoSubmitted:
            row.submitType === 'TIMEOUT' || row.submitType === 'QUIZ_CLOSED',
          link:
            outcome === 'running'
              ? ['/quiz', quizId, 'take']
              : outcome === 'voided'
                ? null
                : ['/quiz', quizId, 'result', row.attemptId],
        };
      })
      .sort((a, b) => b.attemptNo - a.attemptNo);
  });

  readonly total$ = computed(() => this.rows$().length);

  readonly pageRows$ = computed(() => {
    const size = this.pageSize$();
    const start = (this.page$() - 1) * size;
    return this.rows$().slice(start, start + size);
  });

  setPage(page: number): void {
    this.state.page.set(page);
  }

  /** A new page size starts again at the first page. */
  changePageSize(size: number): void {
    this.state.pageSize.set(size);
    this.setPage(1);
  }

  retry(): void {
    this.historyData.reload();
  }

  exportCsv(): void {
    const quizId = this.quizId$();
    if (quizId !== undefined) this.download.run(quizId);
  }
}
