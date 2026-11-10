import { computed, inject, signal, type Signal } from '@angular/core';
import type { Params } from '@angular/router';
import {
  LEARNING_REPORT_SORTS,
  learningReportEndpoints as learning,
  type LearningReportEnrollmentQuery,
  type LearningReportEnrollmentRow,
  type LearningReportExportQuery,
  type LearningReportFilter,
  type LearningReportGroup,
  type LearningReportGroupQuery,
  type LearningStatus,
} from '@lms/contracts';
import type { DataTableSort } from '@lms/ui';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import {
  tabQuery,
  type ProgressView,
  type ReportFilters,
} from './report-query';

/** The rows of one page. */
export const PROGRESS_PAGE_SIZE = 20;

/** A group row of the course or unit view; `drill` is the learner view filtered to it. */
export interface ProgressGroupRow extends LearningReportGroup {
  readonly drill: Params | null;
}

/** A row of the learner view. */
export interface ProgressLearnerRow {
  readonly id: string;
  readonly userId: string;
  readonly fullName: string;
  readonly orgName: string;
  readonly teamName: string | null;
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly progressPercent: number;
  readonly status: string;
  readonly dueAt: string | null;
  readonly overdue: boolean;
  readonly lastAccessAt: string | null;
}

const STATUS_LABELS: Record<LearningStatus, string> = {
  not_started: 'Chưa bắt đầu',
  in_progress: 'Đang học',
  completed: 'Hoàn thành',
};

const DEFAULT_SORT: DataTableSort = { key: 'id', dir: 'asc' };

function learnerRow(row: LearningReportEnrollmentRow): ProgressLearnerRow {
  const e = row.enrollment;
  return {
    id: String(e.id),
    userId: e.userId,
    fullName: row.fullName ?? e.userId,
    orgName: row.orgName ?? '—',
    teamName: row.teamName,
    courseCode: e.courseCode,
    courseTitle: e.courseTitle,
    progressPercent: e.progressPercent,
    status: STATUS_LABELS[e.status],
    dueAt: e.dueAt,
    overdue: e.overdue,
    lastAccessAt: e.lastAccessAt,
  };
}

/** The filter of the learning report endpoints, from the screen's filters. */
export function learningFilter(filters: ReportFilters): LearningReportFilter {
  const {
    orgId,
    teamId,
    courseId,
    programId,
    learningStatus,
    overdue,
    from,
    to,
  } = filters;
  return {
    orgId,
    teamId,
    courseId,
    programId,
    status: learningStatus,
    overdue: overdue || undefined,
    from,
    to,
  };
}

/**
 * "Tiến độ & hoàn thành": the enrolments of the caller's report scope grouped by course or by unit.
 * The server counts every figure; a group's name links to the learner view with that group set.
 *
 * Call it in a store's field initializer. `active` is false while another tab shows, and while a
 * filter of the URL is not known to be in scope.
 */
export function progressReport(input: {
  filters: Signal<ReportFilters>;
  page: Signal<number>;
  active: Signal<boolean>;
}) {
  const client = inject(EndpointClient);
  const saver = inject(FileSaver);
  const view$ = computed<ProgressView>(() => input.filters().view ?? 'course');
  const sort = signal<DataTableSort>(DEFAULT_SORT);
  const pageSize = signal(PROGRESS_PAGE_SIZE);
  const sortParam = computed(() => `${sort().key},${sort().dir}`);

  const groups = serverData(
    (query: LearningReportGroupQuery) =>
      client.call(learning.groups, { query }),
    {
      params: (): LearningReportGroupQuery | undefined => {
        const view = view$();
        if (!input.active() || view === 'learners') return undefined;
        return {
          ...learningFilter(input.filters()),
          groupBy: view,
          page: input.page() - 1,
          size: pageSize(),
        };
      },
    },
  );

  const enrollments = serverData(
    (query: LearningReportEnrollmentQuery) =>
      client.call(learning.enrollments, { query }),
    {
      params: (): LearningReportEnrollmentQuery | undefined =>
        input.active() && view$() === 'learners'
          ? {
              ...learningFilter(input.filters()),
              page: input.page() - 1,
              size: pageSize(),
              sort: sortParam(),
            }
          : undefined,
    },
  );

  const exportMutation = serverMutation(
    (query: LearningReportExportQuery) =>
      client.call(learning.exportEnrollments, { query }),
    {
      // Over the export limit the server refuses; its message shows in the toast.
      errors: 'toast',
      success: () => 'Đã xuất báo cáo CSV',
      onSuccess: (blob) => saver.save(blob, 'bao-cao-tien-do.csv'),
    },
  );

  /** The rows the current view counts: groups, or enrolments in the learner view. */
  const current = computed(() =>
    view$() === 'learners' ? enrollments.value() : groups.value(),
  );

  /** The learner view's query with the group's filter set, or `null` for a group without an id. */
  const drill = (group: LearningReportGroup): Params | null => {
    const id = Number(group.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const filters = input.filters();
    const key =
      view$() === 'org'
        ? 'orgId'
        : view$() === 'program'
          ? 'programId'
          : view$() === 'team'
            ? 'teamId'
            : 'courseId';
    // A unit sets the scope anew: the team under the previous unit no longer applies.
    const scope =
      key === 'orgId' ? { orgId: id, teamId: undefined } : { [key]: id };
    return tabQuery('progress', { ...filters, ...scope, view: 'learners' });
  };

  return {
    view$,
    groups$: computed<readonly ProgressGroupRow[]>(() =>
      (groups.value()?.items ?? []).map((group) => ({
        ...group,
        drill: drill(group),
      })),
    ),
    groupTotal$: computed(() => groups.value()?.totalElements ?? 0),
    learners$: computed<readonly ProgressLearnerRow[]>(() =>
      (enrollments.value()?.items ?? []).map(learnerRow),
    ),
    learnerTotal$: computed(() => enrollments.value()?.totalElements ?? 0),
    total$: computed(() => current()?.totalElements ?? 0),
    /** Whether the current view has answered, so an empty answer can be told from a pending one. */
    loaded$: computed(() => current() !== undefined),
    sort$: sort.asReadonly(),
    loading$: computed(() => groups.isLoading() || enrollments.isLoading()),
    error$: computed(() => groups.error() ?? enrollments.error()),
    exporting$: exportMutation.isPending,
    pageSize$: pageSize.asReadonly(),
    setPageSize(value: number): void {
      pageSize.set(value);
    },
    /** Sorts the learner view on one of the server's keys; returns whether it changed. */
    setSort(value: DataTableSort): boolean {
      if (!(LEARNING_REPORT_SORTS as readonly string[]).includes(value.key))
        return false;
      sort.set(value);
      return true;
    },
    /** The CSV of every enrolment the filters match, in the learner view's sort. */
    exportCsv(): void {
      if (exportMutation.isPending()) return;
      exportMutation.run({
        ...learningFilter(input.filters()),
        sort: sortParam(),
      });
    },
    retry(): void {
      groups.reload();
      enrollments.reload();
    },
  };
}

export type ProgressReport = ReturnType<typeof progressReport>;
