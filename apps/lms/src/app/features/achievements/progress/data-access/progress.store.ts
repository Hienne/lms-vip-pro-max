import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  learnerEndpoints,
  LearningStatusSchema,
  type CourseCard,
  type CourseStatus,
  type LearningStatus,
  type MyCoursesQuery,
  type Page,
  type ProgressExportQuery,
} from '@lms/contracts';
import { NOW, type DataTableSort } from '@lms/ui';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { toCourseStatus } from '../../../../shared/course/course-labels';

export const PROGRESS_PAGE_SIZE = 20;

export type ProgressStatusFilter = 'all' | LearningStatus;

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

export interface ProgressKpi {
  readonly label: string;
  readonly value: number;
  /** Only the overdue count is danger text, and only above zero. */
  readonly danger: boolean;
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
  readonly link: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `tien-do-cua-toi-2026-10-27.csv` for the local day of `time`. */
export function exportFileName(time: number): string {
  const day = new Date(time);
  return `tien-do-cua-toi-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.csv`;
}

/**
 * "Tiến độ của tôi" (SPEC-learner-progress): the server's counts, its course rows and its CSV.
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
    filters: signal<ProgressFilters>(filtersFrom(this.initial)),
    sort: signal<DataTableSort>(sortFrom(this.initial['sort'])),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
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
      size: PROGRESS_PAGE_SIZE,
    }),
  );

  private readonly summaryData = serverData(() =>
    this.client.call(learnerEndpoints.progressSummary),
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
  readonly filters$ = this.state.filters.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly summaryError$ = this.summaryData.error;
  readonly isSummaryLoading$ = this.summaryData.isLoading;
  readonly coursesError$ = this.coursesData.error;
  readonly isCoursesLoading$ = computed(
    () => this.coursesData.isLoading() && this.state.shown() === undefined,
  );
  readonly isExporting$ = this.exports.isPending;

  readonly kpis$ = computed((): readonly ProgressKpi[] => {
    const counts = this.summaryData.value()?.counts;
    if (!counts) return [];
    return [
      { label: 'Tổng số khóa', value: counts.total, danger: false },
      { label: 'Hoàn thành', value: counts.completed, danger: false },
      { label: 'Đang học', value: counts.inProgress, danger: false },
      { label: 'Chưa bắt đầu', value: counts.notStarted, danger: false },
      {
        label: 'Đang quá hạn',
        value: counts.overdue,
        danger: counts.overdue > 0,
      },
    ];
  });

  /** The backend has no hours, scores or competency yet: say so once instead of showing zeros. */
  readonly unavailableNote$ = computed(() => {
    const summary = this.summaryData.value();
    return (
      summary !== undefined &&
      [summary.activity, summary.assessment, summary.competency].some(
        (metric) => metric.availability === 'unavailable',
      )
    );
  });

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
  search(q: string): void {
    this.filter({ q });
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

  exportCsv(): void {
    this.exports.run(this.filterQuery());
  }

  retrySummary(): void {
    this.summaryData.reload();
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
      q: f.q.trim() || null,
      status: f.learningStatus === 'all' ? null : f.learningStatus,
      overdue: f.overdueOnly ? 'true' : null,
      sort: isDefaultSort ? null : sortParam(sort),
      page: this.state.page() > 1 ? this.state.page() : null,
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
  return {
    id: String(card.courseId),
    card,
    title: card.title || card.code,
    status: toCourseStatus(card.learningStatus),
    overdue: card.overdue ?? false,
    pct: Math.round(card.progressPercent ?? 0),
    requiredDone: `${card.completedRequiredLessonCount ?? 0}/${required}`,
    completedLate: card.deadlineStatus === 'completed_late',
    link: `/course/${card.courseId}`,
  };
}
