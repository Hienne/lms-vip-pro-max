import { computed, inject, type Signal } from '@angular/core';
import type { Params } from '@angular/router';
import {
  learningReportEndpoints as learning,
  type LearningReportFilter,
  type LearningReportGroup,
  type LearningReportGroupQuery,
} from '@lms/contracts';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { serverData } from '../../../../core/data-access/server-data';
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

/** The filter of the learning report endpoints, from the screen's filters. */
export function learningFilter(filters: ReportFilters): LearningReportFilter {
  const { orgId, teamId, courseId, learningStatus, overdue, from, to } =
    filters;
  return {
    orgId,
    teamId,
    courseId,
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
  const view$ = computed<ProgressView>(() => input.filters().view ?? 'course');

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
          size: PROGRESS_PAGE_SIZE,
        };
      },
    },
  );

  /** The learner view's query with the group's filter set, or `null` for a group without an id. */
  const drill = (group: LearningReportGroup): Params | null => {
    const id = Number(group.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    const filters = input.filters();
    const key = view$() === 'org' ? 'orgId' : 'courseId';
    // A unit sets the scope anew: the team under the previous unit no longer applies.
    const scope =
      key === 'orgId' ? { orgId: id, teamId: undefined } : { courseId: id };
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
    loading$: computed(() => groups.isLoading()),
    error$: computed(() => groups.error()),
    retry(): void {
      groups.reload();
    },
  };
}

export type ProgressReport = ReturnType<typeof progressReport>;
