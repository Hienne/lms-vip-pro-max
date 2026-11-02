import { computed, inject, Injectable, signal } from '@angular/core';
import {
  learnerEndpoints,
  learnerQuizEndpoints,
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
  | 'mandatory'
  | 'assigned';

export const LEARN_TABS: readonly LearnTab[] = [
  'in_progress',
  'not_started',
  'completed',
  'mandatory',
  'assigned',
];

/** How many courses the tab grid, the due list and the reminders show. */
export const GRID_SIZE = 6;
export const DUE_SHOWN = 5;
export const REMINDERS_SHOWN = 3;
/** The most the server pages: a learner has a handful of programmes, so one page is all of them. */
export const PROGRAMS_SHOWN = 100;

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
  // Courses with an active assignment, not the courses the learner enrolled in themselves.
  assigned: { assigned: true, sort: 'dueAt,asc', size: GRID_SIZE },
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
  /** The card's `progressPercent`, the server's. */
  readonly pct: number;
  readonly link: string;
}

export interface ReminderRow {
  readonly reminder: LearningReminder;
  readonly isOverdue: boolean;
}

/**
 * The learner's home (SPEC-learner-home): where to resume, the counts, the courses by state, what
 * falls due, the competency radar and the reminders. Every read is independent, so one failing section does not blank
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

  /**
   * The dashboard is read only for the server's `completionRate`; the counts and scores come from
   * the summary and the due list from `myCourses`.
   */
  private readonly dashboardData = serverData(() =>
    this.client.call(learnerEndpoints.dashboard),
  );

  /** The programmes the caller has courses in, with the server's progress for each. */
  private readonly programsData = serverData(() =>
    this.client.call(learnerEndpoints.dashboardPrograms, {
      query: { size: PROGRAMS_SHOWN },
    }),
  );

  /** The caller's learning points; the page shows one figure from them and hides it when the read fails. */
  private readonly pointsData = serverData(() =>
    this.client.call(learnerEndpoints.myPoints),
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

  /** The caller's competencies over every course; the server decides which have a percent. */
  private readonly competencyData = serverData(() =>
    this.client.call(learnerQuizEndpoints.myCompetency, { query: {} }),
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

  readonly points$ = this.pointsData.value;

  /** The server's counts with the completion rate; `undefined` until read and after an error. */
  readonly dashboardCounts$ = computed(
    () => this.dashboardData.value()?.learning.counts,
  );
  readonly dashboardError$ = this.dashboardData.error;

  /** Every tab shows the summary's count of the courses it lists. */
  readonly tabCounts$ = computed((): Partial<Record<LearnTab, number>> => {
    const counts = this.summaryData.value()?.counts;
    return counts
      ? {
          in_progress: counts.inProgress,
          not_started: counts.notStarted,
          completed: counts.completed,
          mandatory: counts.mandatory,
          assigned: counts.assigned,
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

  readonly competency$ = this.competencyData.value;
  readonly competencyError$ = this.competencyData.error;
  readonly isCompetencyLoading$ = this.competencyData.isLoading;

  readonly programs$ = computed(() => this.programsData.value()?.items ?? []);
  readonly programsError$ = this.programsData.error;
  readonly isProgramsLoading$ = this.programsData.isLoading;

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
        pct: card.progressPercent ?? 0,
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

  retryDashboard(): void {
    this.dashboardData.reload();
  }

  retryResume(): void {
    this.resumeData.reload();
  }

  retryCourses(): void {
    this.coursesData.reload();
  }

  retryCompetency(): void {
    this.competencyData.reload();
  }

  retryPrograms(): void {
    this.programsData.reload();
  }

  retryDue(): void {
    this.dueData.reload();
  }

  retryReminders(): void {
    this.remindersData.reload();
  }
}
