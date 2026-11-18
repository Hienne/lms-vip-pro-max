import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  competencyReviewEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
  LearningStatusSchema,
  type CourseCard,
  type CourseStatus,
  type LearningStatus,
  type MyAttemptsQuery,
  type MyCoursesQuery,
  type Page,
  type ProgressExportQuery,
} from '@lms/contracts';
import { NOW, PAGE_SIZE_OPTIONS, type DataTableSort } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { toCourseStatus } from '../../../../shared/course/course-labels';
import { isAssessmentAvailable } from '../../../../shared/learning/assessment-overview';

export const PROGRESS_PAGE_SIZE = 10;

/** Number of graded attempts requested per history page. */
export const EXAM_HISTORY_SIZE = 10;

/** How many weak competencies "Ôn lại" lists. */
export const REVIEW_COMPETENCIES = 10;

export type ProgressStatusFilter = 'all' | LearningStatus;
export type ProgressTab = 'courses' | 'competency' | 'history';

/** A page size the table offers; anything else falls back to the default. */
function pageSizeFrom(value: unknown): number {
  const size = Number(value);
  return PAGE_SIZE_OPTIONS.includes(size) ? size : PROGRESS_PAGE_SIZE;
}

function tabFrom(value: unknown): ProgressTab {
  return value === 'competency' || value === 'history' ? value : 'courses';
}

/** A table column's key to the sort field the backend accepts. */
const SORT_FIELD: Readonly<Record<string, string>> = {
  title: 'title',
  progress: 'progressPercent',
  startedAt: 'startedAt',
  lastAccessAt: 'lastAccessAt',
  completedAt: 'completedAt',
  dueAt: 'dueAt',
};

const DEFAULT_SORT: DataTableSort = { key: 'lastAccessAt', dir: 'desc' };

/** The column key behind a `field,dir` sort of the URL; anything unknown is the default. */
function sortFrom(value: unknown): DataTableSort {
  if (typeof value !== 'string') return DEFAULT_SORT;
  const [field, dir] = value.split(',');
  const key = Object.keys(SORT_FIELD).find((k) => SORT_FIELD[k] === field);
  return key && (dir === 'asc' || dir === 'desc') ? { key, dir } : DEFAULT_SORT;
}

const sortParam = (sort: DataTableSort): string =>
  `${SORT_FIELD[sort.key]},${sort.dir}`;

interface ProgressFilters {
  readonly q: string;
  readonly learningStatus: ProgressStatusFilter;
  readonly overdueOnly: boolean;
}

export interface ProgressRow {
  readonly id: string;
  readonly card: CourseCard;
  readonly title: string;
  readonly status: CourseStatus;
  readonly overdue: boolean;
  readonly pct: number;
  readonly requiredDone: string;
  readonly completedLate: boolean;
  /** The server's best score on the course's final exam; null when none was graded. */
  readonly bestScore: number | null;
  readonly link: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `tien-do-cua-toi-2026-10-27.csv` for the local day of `time`. */
export function exportFileName(time: number): string {
  const day = new Date(time);
  return `tien-do-cua-toi-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.csv`;
}

/**
 * "Tiến độ của tôi" (SPEC-learner-progress): the server's counts, its competencies, its course rows and
 * its CSV.
 * The choices live in the URL so a reload or a shared link opens the same table; the table and the
 * export send the same filters and sort.
 */
@Injectable()
export class ProgressStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly saver = inject(FileSaver);
  private readonly now = inject(NOW);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    tab: signal<ProgressTab>(tabFrom(this.initial['tab'])),
    filters: signal<ProgressFilters>(filtersFrom(this.initial)),
    sort: signal<DataTableSort>(sortFrom(this.initial['sort'])),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
    pageSize: signal(pageSizeFrom(this.initial['size'])),
    /** The last page the server sent: the table stays while the next one loads. */
    shown: linkedSignal<
      Page<CourseCard> | undefined,
      Page<CourseCard> | undefined
    >({
      source: () => this.coursesData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  /** The table's filters and sort, without paging: what the export sends too. */
  private readonly filterQuery = computed((): ProgressExportQuery => {
    const { q, learningStatus, overdueOnly } = this.state.filters();
    return {
      sort: sortParam(this.state.sort()),
      ...(q.trim() ? { q: q.trim().slice(0, 100) } : {}),
      ...(learningStatus !== 'all' ? { learningStatus } : {}),
      ...(overdueOnly ? { overdue: true } : {}),
    };
  });

  private readonly tableQuery = computed(
    (): MyCoursesQuery => ({
      ...this.filterQuery(),
      page: this.state.page() - 1,
      size: this.state.pageSize(),
    }),
  );

  private readonly weeklyData = serverData(() =>
    this.client.call(learnerEndpoints.weeklyActivity, { query: { weeks: 8 } }),
  );
  readonly weekly$ = this.weeklyData.value;
  readonly weeklyError$ = this.weeklyData.error;
  readonly weeklyBars$ = computed(() =>
    (this.weekly$()?.weeks ?? []).map((week) => ({
      label: week.weekStart.slice(5).split('-').reverse().join('/'),
      value: week.activeDays,
    })),
  );
  retryWeekly(): void {
    this.weeklyData.reload();
  }

  private readonly summaryData = serverData(() =>
    this.client.call(learnerEndpoints.progressSummary),
  );

  /** The streak in working days and the 26-week heatmap; the server decides what counts. */
  private readonly streakData = serverData(() =>
    this.client.call(learnerEndpoints.myStreak),
  );

  /** The caller's competencies over every course; the server decides which have a percent. */
  private readonly competencyData = serverData(() =>
    this.client.call(learnerQuizEndpoints.myCompetency, { query: {} }),
  );

  /** The weak competencies and the lessons their mistakes come from (the server's, weakest first). */
  private readonly reviewData = serverData(() =>
    this.client.call(competencyReviewEndpoints.review, {
      query: { limit: REVIEW_COMPETENCIES },
    }),
  );

  private readonly historySearch = signal('');
  private readonly historyResult = signal('all');
  private readonly historyPage = signal(1);
  private readonly historyPageSize = signal(EXAM_HISTORY_SIZE);
  readonly historyPageSize$ = this.historyPageSize.asReadonly();
  readonly historySearch$ = this.historySearch.asReadonly();
  readonly historyResult$ = this.historyResult.asReadonly();
  readonly historyPage$ = this.historyPage.asReadonly();
  readonly historyHasFilters$ = computed(
    () => !!this.historySearch() || this.historyResult() !== 'all',
  );
  clearHistoryFilters(): void {
    this.historySearch.set('');
    this.historyResult.set('all');
    this.historyPage.set(1);
  }
  private readonly historyQuery = computed(
    (): MyAttemptsQuery => ({
      graded: true,
      sort: 'submittedAt,desc',
      page: this.historyPage() - 1,
      size: this.historyPageSize(),
      ...(this.historySearch().trim()
        ? { q: this.historySearch().trim().slice(0, 100) }
        : {}),
      ...(this.historyResult() === 'all'
        ? {}
        : { passed: this.historyResult() === 'passed' }),
    }),
  );
  private readonly attemptsData = serverData(
    (query: MyAttemptsQuery) =>
      this.client.call(learnerQuizEndpoints.myAttempts, { query }),
    { params: () => this.historyQuery() },
  );
  searchHistory(value: string): void {
    this.historySearch.set(value);
    this.historyPage.set(1);
  }
  filterHistoryResult(value: string): void {
    this.historyResult.set(value);
    this.historyPage.set(1);
  }
  goToHistoryPage(page: number): void {
    this.historyPage.set(page);
  }
  /** A new page size starts again at the first page. */
  changeHistoryPageSize(size: number): void {
    this.historyPageSize.set(
      PAGE_SIZE_OPTIONS.includes(size) ? size : EXAM_HISTORY_SIZE,
    );
    this.historyPage.set(1);
  }
  readonly historyTotal$ = computed(
    () => this.attemptsData.value()?.totalElements ?? 0,
  );

  private readonly coursesData = serverData(
    (query: MyCoursesQuery) =>
      this.client.call(learnerEndpoints.myCourses, { query }),
    { params: () => this.tableQuery() },
  );

  /** The CSV saved under the day's name; the download is its own feedback, so no success toast. */
  private readonly exports = serverMutation(
    (query: ProgressExportQuery) =>
      this.client.call(learnerEndpoints.exportProgress, { query }),
    {
      errors: 'toast',
      onSuccess: (blob) => this.saver.save(blob, exportFileName(this.now())),
    },
  );

  // Selectors
  readonly tab$ = this.state.tab.asReadonly();
  readonly filters$ = this.state.filters.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly sortValue$ = computed(() => sortParam(this.state.sort()));
  readonly page$ = this.state.page.asReadonly();
  readonly pageSize$ = this.state.pageSize.asReadonly();

  readonly streak$ = this.streakData.value;
  readonly streakError$ = this.streakData.error;
  readonly isStreakLoading$ = this.streakData.isLoading;
  readonly summaryError$ = this.summaryData.error;
  readonly isSummaryLoading$ = this.summaryData.isLoading;
  readonly coursesError$ = this.coursesData.error;
  readonly isCoursesLoading$ = computed(
    () => this.coursesData.isLoading() && this.state.shown() === undefined,
  );
  readonly isExporting$ = this.exports.isPending;

  readonly competency$ = this.competencyData.value;
  readonly competencyError$ = this.competencyData.error;
  readonly isCompetencyLoading$ = this.competencyData.isLoading;
  readonly review$ = computed(() => this.reviewData.value() ?? []);
  readonly reviewError$ = this.reviewData.error;
  readonly isReviewLoading$ = this.reviewData.isLoading;

  /** The server's counts and availabilities; no filter touches them. */
  readonly summary$ = this.summaryData.value;

  /** The server's average quiz score; null before any graded attempt, undefined while unavailable. */
  readonly averageScore$ = computed(() => {
    const assessment = this.summaryData.value()?.assessment;
    return assessment && isAssessmentAvailable(assessment)
      ? assessment.averageScorePercent
      : undefined;
  });

  readonly attempts$ = computed(() => this.attemptsData.value()?.items);
  readonly filteredAttempts$ = computed(() => this.attempts$() ?? []);
  readonly attemptsError$ = this.attemptsData.error;
  readonly isAttemptsLoading$ = this.attemptsData.isLoading;

  readonly rows$ = computed((): readonly ProgressRow[] =>
    (this.state.shown()?.items ?? []).map(toRow),
  );
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);

  /** No course at all (the summary's total, which no filter touches). */
  readonly isEmpty$ = computed(
    () => this.summaryData.value()?.counts.total === 0,
  );

  /** Courses exist, but the filters match none. */
  readonly noMatch$ = computed(
    () =>
      this.summaryData.value()?.counts.total !== 0 &&
      this.state.shown() !== undefined &&
      this.total$() === 0,
  );

  readonly hasFilters$ = computed(() => {
    const f = this.state.filters();
    return f.q.trim() !== '' || f.learningStatus !== 'all' || f.overdueOnly;
  });

  // Setters: the only writers of state
  private setTab(tab: ProgressTab): void {
    this.state.tab.set(tab);
  }

  private setFilters(filters: ProgressFilters): void {
    this.state.filters.set(filters);
  }

  private setSort(sort: DataTableSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed choice starts again at the first page and is written to the URL
  selectTab(tab: string): void {
    this.setTab(tabFrom(tab));
    this.syncUrl();
  }

  toggleSort(key: string): void {
    const current = this.state.sort();
    this.sortBy({
      key,
      dir: current.key === key && current.dir === 'asc' ? 'desc' : 'asc',
    });
  }

  sortByValue(value: string): void {
    this.sortBy(sortFrom(value));
  }

  search(q: string): void {
    this.filter({ q });
  }

  filterCount(
    value: 'all' | 'completed' | 'in_progress' | 'not_started' | 'overdue',
  ): void {
    this.setTab('courses');
    this.filter({
      q: '',
      learningStatus: value === 'overdue' ? 'all' : value,
      overdueOnly: value === 'overdue',
    });
  }

  filterStatus(value: string): void {
    const status = LearningStatusSchema.safeParse(value);
    this.filter({ learningStatus: status.success ? status.data : 'all' });
  }

  filterOverdue(overdueOnly: boolean): void {
    this.filter({ overdueOnly });
  }

  clearFilters(): void {
    this.setFilters(NO_FILTERS);
    this.setPage(1);
    this.syncUrl();
  }

  sortBy(sort: DataTableSort): void {
    if (!SORT_FIELD[sort.key]) return;
    this.setSort(sort);
    this.setPage(1);
    this.syncUrl();
  }

  goToPage(page: number): void {
    this.setPage(page);
    this.syncUrl();
  }

  /** A new page size starts again at the first page. */
  changePageSize(size: number): void {
    this.state.pageSize.set(pageSizeFrom(size));
    this.setPage(1);
    this.syncUrl();
  }

  exportCsv(): void {
    this.exports.run(this.filterQuery());
  }

  retrySummary(): void {
    this.summaryData.reload();
  }

  retryStreak(): void {
    this.streakData.reload();
  }

  retryCompetency(): void {
    this.competencyData.reload();
  }

  retryReview(): void {
    this.reviewData.reload();
  }

  retryAttempts(): void {
    this.attemptsData.reload();
  }

  retryCourses(): void {
    this.coursesData.reload();
  }

  private filter(change: Partial<ProgressFilters>): void {
    this.setFilters({ ...this.state.filters(), ...change });
    this.setPage(1);
    this.syncUrl();
  }

  /** Writes the choices to the query string without a history entry; defaults are left out. */
  private syncUrl(): void {
    const f = this.state.filters();
    const sort = this.state.sort();
    const isDefaultSort =
      sort.key === DEFAULT_SORT.key && sort.dir === DEFAULT_SORT.dir;
    const queryParams: Params = {
      tab: this.state.tab() === 'courses' ? null : this.state.tab(),
      q: f.q.trim() || null,
      status: f.learningStatus === 'all' ? null : f.learningStatus,
      overdue: f.overdueOnly ? 'true' : null,
      sort: isDefaultSort ? null : sortParam(sort),
      page: this.state.page() > 1 ? this.state.page() : null,
      size:
        this.state.pageSize() === PROGRESS_PAGE_SIZE
          ? null
          : this.state.pageSize(),
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }
}

const NO_FILTERS: ProgressFilters = {
  q: '',
  learningStatus: 'all',
  overdueOnly: false,
};

/** The filters a shared or reloaded URL carries; an unknown value is dropped, not an error. */
function filtersFrom(params: Params): ProgressFilters {
  const status = LearningStatusSchema.safeParse(params['status']);
  return {
    q: typeof params['q'] === 'string' ? params['q'] : '',
    learningStatus: status.success ? status.data : 'all',
    overdueOnly: params['overdue'] === 'true',
  };
}

/** A server row as the table shows it; every number is the server's. */
function toRow(card: CourseCard): ProgressRow {
  const required = card.requiredLessonCount ?? 0;
  const title = card.title || card.code;
  return {
    id: String(card.courseId),
    card,
    title,
    status: toCourseStatus(card.learningStatus),
    overdue: card.overdue ?? false,
    pct: Math.round(card.progressPercent ?? 0),
    requiredDone: `${card.completedRequiredLessonCount ?? 0}/${required}`,
    completedLate: card.deadlineStatus === 'completed_late',
    bestScore: card.bestScorePercent ?? null,
    link: `/course/${card.courseId}`,
  };
}
