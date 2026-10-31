import { computed, inject, Injectable, signal } from '@angular/core';
import {
  learnerEndpoints,
  type CourseCard,
  type LearningReminder,
  type MyCoursesQuery,
} from '@lms/contracts';
import { NOW } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { dueReminders } from '../../../../core/learning/due-reminders';
import { SessionStore } from '../../../../core/session/session.store';
import type { CourseCardView } from '../../../../shared/course/course-card';
import { toCourseCardView } from '../../../../shared/course/course-card-view';
import { isReminderOverdue } from '../../../../shared/learning/reminder-item/reminder-item';

export type LearnTab =
  | 'in_progress'
  | 'not_started'
  | 'completed'
  | 'mandatory';

export const LEARN_TABS: readonly LearnTab[] = [
  'in_progress',
  'not_started',
  'completed',
  'mandatory',
];

/** How many courses the tab grid, the due list and the reminders show. */
export const GRID_SIZE = 6;
export const DUE_SHOWN = 5;
export const REMINDERS_SHOWN = 3;

const TAB_QUERY: Record<LearnTab, MyCoursesQuery> = {
  in_progress: {
    learningStatus: 'in_progress',
    sort: 'lastAccessAt,desc',
    size: GRID_SIZE,
  },
  not_started: {
    learningStatus: 'not_started',
    sort: 'dueAt,asc',
    size: GRID_SIZE,
  },
  completed: {
    learningStatus: 'completed',
    sort: 'completedAt,desc',
    size: GRID_SIZE,
  },
  mandatory: { requirement: 'mandatory', sort: 'dueAt,asc', size: GRID_SIZE },
};

export interface ContinueView {
  readonly courseTitle: string;
  /** "chapter · course" once the enrolment detail is read, else the course alone. */
  readonly lessonTitle: string;
  readonly context: string;
  readonly pct: number;
  readonly link: string;
  /** `block` of the lesson link: the block the learner left off at. */
  readonly query: { readonly block: number } | null;
}

export interface DueRow {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string;
  readonly link: string;
}

export interface ReminderRow {
  readonly reminder: LearningReminder;
  readonly isOverdue: boolean;
}

/**
 * The learner's home (SPEC-learner-home): where to resume, the counts, the courses by state, what
 * falls due and the reminders. Every read is independent, so one failing section does not blank
 * the page. Nothing is computed here: the server's numbers and filters, shown.
 */
@Injectable()
export class LearnStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly now = inject(NOW);

  private readonly state = {
    tab: signal<LearnTab>('in_progress'),
  };

  private readonly canLearn = computed(() =>
    this.session.menus$().includes('COURSE_LEARNING'),
  );

  private readonly summaryData = serverData(() =>
    this.client.call(learnerEndpoints.progressSummary),
  );

  private readonly resumeData = serverData(() =>
    this.client.call(learnerEndpoints.myCourses, {
      query: {
        learningStatus: 'in_progress',
        sort: 'lastAccessAt,desc',
        size: 1,
      },
    }),
  );

  private readonly resumeCard = computed(
    (): CourseCard | undefined => this.resumeData.value()?.items[0],
  );

  /** The lesson and chapter titles of `lastLessonId` live in the enrolment's content. */
  private readonly detailData = serverData(
    (enrollmentId: number) =>
      this.client.call(learnerEndpoints.enrollment, {
        params: { enrollmentId },
      }),
    { params: () => this.resumeCard()?.enrollmentId ?? undefined },
  );

  private readonly coursesData = serverData(
    (query: MyCoursesQuery) =>
      this.client.call(learnerEndpoints.myCourses, { query }),
    { params: () => TAB_QUERY[this.state.tab()] },
  );

  private readonly dueData = serverData(() =>
    this.client.call(learnerEndpoints.myCourses, {
      query: { sort: 'dueAt,asc', size: 10 },
    }),
  );

  private readonly remindersData = serverData(
    (_: { readonly learner: true }) => dueReminders(this.client),
    {
      params: () => (this.canLearn() ? { learner: true as const } : undefined),
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();

  readonly summary$ = this.summaryData.value;
  readonly summaryError$ = this.summaryData.error;
  readonly isSummaryLoading$ = this.summaryData.isLoading;

  /** The three status tabs show the summary's counts; "Bắt buộc" has none. */
  readonly tabCounts$ = computed((): Partial<Record<LearnTab, number>> => {
    const counts = this.summaryData.value()?.counts;
    return counts
      ? {
          in_progress: counts.inProgress,
          not_started: counts.notStarted,
          completed: counts.completed,
        }
      : {};
  });

  readonly resumeError$ = this.resumeData.error;
  readonly isResumeLoading$ = computed(
    () =>
      this.resumeData.isLoading() ||
      (this.resumeCard()?.enrollmentId != null && this.detailData.isLoading()),
  );

  /** The in-progress course the learner touched last, or `null` when none is in progress. */
  readonly resume$ = computed((): ContinueView | null => {
    const card = this.resumeCard();
    if (!card) return null;
    const courseTitle = card.title || card.code;
    const lessonId = card.lastLessonId;
    const chapters = this.detailData.value()?.content.chapters ?? [];
    const found = lessonId
      ? chapters
          .flatMap((c) =>
            c.lessons.map((l) => ({ chapter: c.chapter, lesson: l.lesson })),
          )
          .find((entry) => entry.lesson.id === lessonId)
      : undefined;
    return {
      courseTitle,
      lessonTitle: found?.lesson.title ?? courseTitle,
      context: found ? `${found.chapter.title} · ${courseTitle}` : '',
      pct: Math.round(card.progressPercent ?? 0),
      link: lessonId
        ? `/lesson/${card.courseId}/${lessonId}`
        : `/course/${card.courseId}`,
      query: lessonId && card.lastBlockId ? { block: card.lastBlockId } : null,
    };
  });

  readonly coursesError$ = this.coursesData.error;
  readonly isCoursesLoading$ = this.coursesData.isLoading;

  readonly courses$ = computed((): readonly CourseCardView[] =>
    (this.coursesData.value()?.items ?? []).map(toCourseCardView),
  );

  readonly dueError$ = this.dueData.error;
  readonly isDueLoading$ = this.dueData.isLoading;

  /** One server page by due date, kept to the dated courses still open: display filtering only. */
  readonly due$ = computed((): readonly DueRow[] =>
    (this.dueData.value()?.items ?? [])
      .filter(
        (card) =>
          card.dueAt && (card.learningStatus ?? 'not_started') !== 'completed',
      )
      .slice(0, DUE_SHOWN)
      .map((card) => ({
        id: String(card.courseId),
        title: card.title || card.code,
        dueAt: card.dueAt as string,
        link: `/course/${card.courseId}`,
      })),
  );

  readonly remindersError$ = this.remindersData.error;
  readonly isRemindersLoading$ = this.remindersData.isLoading;

  readonly reminders$ = computed((): readonly ReminderRow[] => {
    const now = this.now();
    return [...(this.remindersData.value() ?? [])]
      .sort(
        (a, b) =>
          (a.dueAtSnapshot ?? '').localeCompare(b.dueAtSnapshot ?? '') ||
          a.id - b.id,
      )
      .slice(0, REMINDERS_SHOWN)
      .map((reminder) => ({
        reminder,
        isOverdue: isReminderOverdue(reminder, now),
      }));
  });

  // Setters: the only writers of state
  private setTab(tab: LearnTab): void {
    this.state.tab.set(tab);
  }

  // Commands
  showTab(value: string): void {
    const tab = LEARN_TABS.find((candidate) => candidate === value);
    if (tab) this.setTab(tab);
  }

  retrySummary(): void {
    this.summaryData.reload();
  }

  retryResume(): void {
    this.resumeData.reload();
  }

  retryCourses(): void {
    this.coursesData.reload();
  }

  retryDue(): void {
    this.dueData.reload();
  }

  retryReminders(): void {
    this.remindersData.reload();
  }
}
