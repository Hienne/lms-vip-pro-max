import { computed, inject, Injectable } from '@angular/core';
import {
  learnerEndpoints,
  learnerQuizEndpoints,
  type LearnerQuizCard,
  type MyAttemptRow,
} from '@lms/contracts';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { blockReasonText } from '../../../../shared/quiz/quiz-block-reason';

/** Courses the learner is in the middle of whose quizzes the hub lists. */
const COURSES_SHOWN = 10;
/** The server's page maximum: one request holds the history the hub groups. */
const ATTEMPTS_SHOWN = 100;
/** Attempts shown under each quiz before the link to its full history. */
export const ATTEMPTS_PER_QUIZ = 3;

export interface CourseQuizzes {
  readonly courseId: number;
  readonly courseTitle: string;
  readonly cards: readonly LearnerQuizCard[];
}

export interface QuizRow {
  readonly quizId: number;
  readonly title: string;
  readonly courseTitle: string;
  readonly passPercent: number;
  readonly attemptsLeft: number;
  readonly bestScore: number | null;
  readonly passed: boolean;
  readonly canStart: boolean;
  readonly resuming: boolean;
  /** The server's reason the quiz cannot start now, worded; `null` when it can. */
  readonly blockText: string | null;
}

export interface AttemptGroup {
  readonly quizId: number;
  readonly title: string;
  readonly attemptCount: number;
  /** Newest first, at most {@link ATTEMPTS_PER_QUIZ}. */
  readonly recent: readonly MyAttemptRow[];
}

/**
 * The quiz hub: the quizzes of the courses the learner is in the middle of, and the attempts they
 * have made grouped by quiz. Both lists are what the server sent; the store only arranges them.
 */
@Injectable()
export class QuizHubStore {
  private readonly client = inject(EndpointClient);
  private readonly fileSaver = inject(FileSaver);

  private readonly quizzesData = serverData(() =>
    this.client
      .call(learnerEndpoints.myCourses, {
        query: {
          learningStatus: 'in_progress',
          sort: 'lastAccessAt,desc',
          size: COURSES_SHOWN,
        },
      })
      .pipe(
        switchMap((page) =>
          page.items.length === 0
            ? of([] as CourseQuizzes[])
            : forkJoin(
                page.items.map((course) =>
                  this.client
                    .call(learnerQuizEndpoints.courseQuizzes, {
                      params: { courseId: course.courseId },
                    })
                    .pipe(
                      map(
                        (cards): CourseQuizzes => ({
                          courseId: course.courseId,
                          courseTitle: course.title || course.code,
                          cards,
                        }),
                      ),
                    ),
                ),
              ),
        ),
      ),
  );

  private readonly attemptsData = serverData(() =>
    this.client.call(learnerQuizEndpoints.myAttempts, {
      query: { page: 0, size: ATTEMPTS_SHOWN, sort: 'startedAt,desc' },
    }),
  );

  private readonly download = serverMutation(
    () =>
      this.client.call(learnerQuizEndpoints.exportAttempts, {
        query: { sort: 'startedAt,desc' },
      }),
    {
      errors: 'toast',
      onSuccess: (blob) => this.fileSaver.save(blob, 'lich-su-thi.csv'),
    },
  );

  readonly loadError$ = computed(
    () => this.quizzesData.error() ?? this.attemptsData.error(),
  );
  readonly isLoading$ = computed(
    () => this.quizzesData.isLoading() || this.attemptsData.isLoading(),
  );
  readonly isExporting$ = this.download.isPending;

  /** Every quiz of those courses, a course's final exam after its other quizzes (server order). */
  readonly quizzes$ = computed((): readonly QuizRow[] =>
    (this.quizzesData.value() ?? []).flatMap(({ courseTitle, cards }) =>
      cards.map(
        ({ quiz, summary, canStart, blockReason, availableAt }): QuizRow => ({
          quizId: quiz.id,
          title: quiz.title,
          courseTitle,
          passPercent: quiz.passPercent,
          attemptsLeft: summary.attemptsLeft,
          bestScore: summary.bestScore,
          passed: summary.passed,
          canStart,
          resuming: summary.runningAttemptId != null,
          blockText: blockReason
            ? blockReasonText(blockReason, {
                availableAt,
                closeAt: quiz.closeAt,
              })
            : null,
        }),
      ),
    ),
  );

  /** Attempts grouped by quiz, the quiz tried most recently first. */
  readonly groups$ = computed((): readonly AttemptGroup[] => {
    const groups = new Map<number, MyAttemptRow[]>();
    for (const row of this.attemptsData.value()?.items ?? []) {
      const rows = groups.get(row.quizId);
      if (rows) rows.push(row);
      else groups.set(row.quizId, [row]);
    }
    return [...groups.entries()].map(([quizId, rows]) => {
      return {
        quizId,
        title: rows[0].quizTitle,
        attemptCount: rows.length,
        recent: rows.slice(0, ATTEMPTS_PER_QUIZ),
      };
    });
  });

  retry(): void {
    this.quizzesData.reload();
    this.attemptsData.reload();
  }

  exportCsv(): void {
    this.download.run(undefined);
  }
}
