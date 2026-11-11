import { computed, inject, Injectable } from '@angular/core';
import {
  learnerEndpoints,
  learnerQuizEndpoints,
  type LearnerQuizCard,
  type MyAttemptRow,
} from '@lms/contracts';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { serverData } from '../../../../../core/data-access/server-data';
import { serverMutation } from '../../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../../core/files/file-saver';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { blockReasonText } from '../../../../../shared/quiz/quiz-block-reason';

/** Courses the learner is in the middle of whose quizzes the hub lists. */
const COURSES_SHOWN = 10;
/** The server's page maximum: one request holds the history the hub groups. */
const ATTEMPTS_SHOWN = 100;
/** Attempts the selected quiz's table shows before the link to its full history. */
export const ATTEMPTS_PER_QUIZ = 10;

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
  /** Every attempt the hub loaded for the quiz, newest first. */
  readonly recent: readonly MyAttemptRow[];
}

/**
 * A quiz in the hub's list: what the course card says about it when the quiz belongs to a course in
 * progress (`null` fields otherwise), and the attempts the learner made on it.
 */
export interface QuizEntry {
  readonly quizId: number;
  readonly title: string;
  readonly courseTitle: string | null;
  readonly passPercent: number | null;
  readonly attemptsLeft: number | null;
  readonly bestScore: number | null;
  readonly passed: boolean;
  readonly canStart: boolean;
  readonly resuming: boolean;
  readonly blockText: string | null;
  /** Newest first. */
  readonly attempts: readonly MyAttemptRow[];
  /** When the latest attempt started or was submitted; `null` before any attempt. */
  readonly lastAt: string | null;
}

export const QUIZ_FILTERS = ['all', 'open', 'passed', 'failed'] as const;
export type QuizFilter = (typeof QUIZ_FILTERS)[number];

/** `open`: can be taken or resumed now. `failed`: tried and not passed yet. */
function matches(entry: QuizEntry, filter: QuizFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'open':
      return entry.canStart || entry.resuming;
    case 'passed':
      return entry.passed;
    case 'failed':
      return !entry.passed && entry.attempts.length > 0;
  }
}

function lastAt(rows: readonly MyAttemptRow[]): string | null {
  const [latest] = rows;
  return latest ? (latest.submittedAt ?? latest.startedAt) : null;
}

function bestOf(rows: readonly MyAttemptRow[]): number | null {
  const scores = rows
    .map((row) => row.scorePercent)
    .filter((score): score is number => score !== null);
  return scores.length ? Math.max(...scores) : null;
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
    return [...groups.entries()].map(([quizId, rows]) => ({
      quizId,
      title: rows[0].quizTitle,
      attemptCount: rows.length,
      recent: rows,
    }));
  });

  /**
   * One entry per quiz the learner can see here: every quiz of the courses in progress, then the
   * quizzes they only have attempts on. A quiz they can take or resume comes first; the rest keep
   * the order of their latest attempt.
   */
  readonly entries$ = computed((): readonly QuizEntry[] => {
    const attempts = new Map(this.groups$().map((g) => [g.quizId, g.recent]));
    const open = this.quizzes$().map((quiz): QuizEntry => {
      const rows = attempts.get(quiz.quizId) ?? [];
      return {
        ...quiz,
        courseTitle: quiz.courseTitle,
        attempts: rows,
        lastAt: lastAt(rows),
      };
    });
    const known = new Set(open.map((entry) => entry.quizId));
    const historyOnly = this.groups$()
      .filter((group) => !known.has(group.quizId))
      .map(
        (group): QuizEntry => ({
          quizId: group.quizId,
          title: group.title,
          courseTitle: null,
          passPercent: null,
          attemptsLeft: null,
          bestScore: bestOf(group.recent),
          passed: group.recent.some((row) => row.passed === true),
          canStart: false,
          resuming: false,
          blockText: null,
          attempts: group.recent,
          lastAt: lastAt(group.recent),
        }),
      );
    const actionable = (entry: QuizEntry) => entry.resuming || entry.canStart;
    return [
      ...open.filter(actionable),
      ...[...open.filter((entry) => !actionable(entry)), ...historyOnly].sort(
        (a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''),
      ),
    ];
  });

  /** How many entries each filter holds, for the filter labels. */
  readonly filterCounts$ = computed(
    (): Readonly<Record<QuizFilter, number>> => {
      const entries = this.entries$();
      return Object.fromEntries(
        QUIZ_FILTERS.map((filter) => [
          filter,
          entries.filter((entry) => matches(entry, filter)).length,
        ]),
      ) as Record<QuizFilter, number>;
    },
  );

  /** The entries one filter keeps, in the order of {@link entries$}. */
  filtered(filter: QuizFilter): readonly QuizEntry[] {
    return this.entries$().filter((entry) => matches(entry, filter));
  }

  retry(): void {
    this.quizzesData.reload();
    this.attemptsData.reload();
  }

  exportCsv(): void {
    this.download.run(undefined);
  }
}
