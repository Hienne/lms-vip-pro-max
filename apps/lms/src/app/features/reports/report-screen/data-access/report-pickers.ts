import {
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import { EMPTY, expand, reduce } from 'rxjs';
import {
  assessmentReportEndpoints as assessment,
  learningReportEndpoints as learning,
  type LearningReportGroup,
  type LearningReportGroupQuery,
} from '@lms/contracts';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { serverData } from '../../../../core/data-access/server-data';
import type { ReportPickerOption } from '../components/report-picker/report-picker';
import type { ReportFilters } from './report-query';

/** The filters picked by name, each narrowing the next. */
export type PickerKey = 'orgId' | 'teamId' | 'courseId' | 'quizId';
type Picks = Record<PickerKey, number | undefined>;

/** What picking a parent clears. */
const CHILDREN: Record<PickerKey, readonly PickerKey[]> = {
  orgId: ['teamId', 'courseId', 'quizId'],
  teamId: ['courseId', 'quizId'],
  courseId: ['quizId'],
  quizId: [],
};

const KEYS: readonly PickerKey[] = ['orgId', 'teamId', 'courseId', 'quizId'];

/** One value per picker. */
function byKey<T>(value: (key: PickerKey) => T): Record<PickerKey, T> {
  return {
    orgId: value('orgId'),
    teamId: value('teamId'),
    courseId: value('courseId'),
    quizId: value('quizId'),
  };
}

const NOT_FOUND: Record<PickerKey, string> = {
  orgId: 'Không tìm thấy đơn vị này trong phạm vi của bạn.',
  teamId: 'Không tìm thấy phòng / nhóm này trong phạm vi của bạn.',
  courseId: 'Không tìm thấy khóa học này trong phạm vi của bạn.',
  quizId: 'Không tìm thấy bài kiểm tra này trong phạm vi của bạn.',
};

const PAGE_SIZE = 100;

/** Groups with no entity (for example, learners without a team) are not selectable IDs. */
const groupOptions = (
  groups: readonly LearningReportGroup[],
): ReportPickerOption[] =>
  groups.flatMap((group) => {
    const id = Number(group.id);
    return Number.isSafeInteger(id) && id > 0
      ? [{ id, name: group.name ?? String(id) }]
      : [];
  });

const pick = (filters: ReportFilters): Picks => ({
  orgId: filters.orgId,
  teamId: filters.teamId,
  courseId: filters.courseId,
  quizId: filters.quizId,
});

/**
 * The report filter pickers. Their options come from the report endpoints themselves, which every
 * report role may read and which the server scopes: units and teams from the learning report
 * groups, courses from its course groups, and quizzes from the assessment report scope.
 * The ids the URL applies are resolved through the same reads; one that
 * cannot be (not found, or outside the caller's scope) blocks the report.
 *
 * Call it in a store's field initializer, with the filters the URL applies.
 */
export function reportPickers(applied: Signal<ReportFilters>) {
  const client = inject(EndpointClient);
  const groups = (query: LearningReportGroupQuery) =>
    client
      .call(learning.groups, { query: { ...query, page: 0, size: PAGE_SIZE } })
      .pipe(
        expand((result) =>
          result.page + 1 < result.totalPages
            ? client.call(learning.groups, {
                query: { ...query, page: result.page + 1, size: PAGE_SIZE },
              })
            : EMPTY,
        ),
        reduce((items, result) => {
          items.push(...result.items);
          return items;
        }, [] as LearningReportGroup[]),
      );

  const state = {
    /** The ids picked in the form, until "Áp dụng bộ lọc" writes them to the URL. */
    picks: linkedSignal<Picks>(() => pick(applied())),
    /** The options picked in this visit, so their names show before any read answers. */
    known: signal<Partial<Record<PickerKey, ReportPickerOption>>>({}),
  };
  const picks$ = state.picks.asReadonly();

  const orgs = serverData(() => groups({ groupBy: 'org' }));
  const teams = serverData(
    (orgId: number) => groups({ groupBy: 'team', orgId }),
    {
      params: () => picks$().orgId,
    },
  );
  const courses = serverData(
    (query: LearningReportGroupQuery) => groups(query),
    {
      params: () => ({
        groupBy: 'course' as const,
        orgId: picks$().orgId,
        teamId: picks$().teamId,
        programId: applied().programId,
      }),
    },
  );
  // The URL's ids, each read on its own so a shared link shows names before anything is picked.
  const appliedTeam = serverData(
    (query: LearningReportGroupQuery) => groups(query),
    {
      params: (): LearningReportGroupQuery | undefined => {
        const { orgId, teamId } = applied();
        return teamId ? { groupBy: 'team', orgId, teamId } : undefined;
      },
    },
  );
  const appliedCourse = serverData(
    (query: LearningReportGroupQuery) => groups(query),
    {
      params: (): LearningReportGroupQuery | undefined => {
        const { orgId, teamId, courseId, programId } = applied();
        return courseId
          ? { groupBy: 'course', orgId, teamId, courseId, programId }
          : undefined;
      },
    },
  );
  const appliedCourseInScope = computed(
    () =>
      appliedCourse
        .value()
        ?.some((course) => Number(course.id) === applied().courseId) ?? false,
  );
  type QuizOptionsQuery = {
    orgId?: number;
    teamId?: number;
    courseId?: number;
    quizId?: number;
  };
  const quizOptions = (query: QuizOptionsQuery) =>
    client.call(assessment.quizOptions, { query });
  const quizzes = serverData(quizOptions, {
    params: () => {
      const { orgId, teamId, courseId } = picks$();
      const current = applied();
      const sameScope =
        orgId === current.orgId &&
        teamId === current.teamId &&
        courseId === current.courseId;
      return courseId !== undefined && (!sameScope || appliedCourseInScope())
        ? { orgId, teamId, courseId }
        : undefined;
    },
  });
  const appliedQuiz = serverData(quizOptions, {
    params: () => {
      const { orgId, teamId, quizId, courseId } = applied();
      return quizId && (!courseId || appliedCourseInScope())
        ? { orgId, teamId, quizId, courseId }
        : undefined;
    },
  });

  const options: Record<PickerKey, Signal<readonly ReportPickerOption[]>> = {
    orgId: computed(() => groupOptions(orgs.value() ?? [])),
    teamId: computed(() => groupOptions(teams.value() ?? [])),
    courseId: computed(() => groupOptions(courses.value() ?? [])),
    quizId: computed(() => quizzes.value() ?? []),
  };

  /** The URL's option per key: found, `null` when the read found none, `undefined` while unknown. */
  const resolved = computed<
    Record<PickerKey, ReportPickerOption | null | undefined>
  >(() => {
    const ids = applied();
    const find = (
      id: number | undefined,
      list: readonly ReportPickerOption[] | undefined,
    ) =>
      id === undefined || list === undefined
        ? undefined
        : (list.find((option) => option.id === id) ?? null);
    return {
      orgId: find(ids.orgId, orgs.value() && options.orgId()),
      teamId: find(
        ids.teamId,
        appliedTeam.value() && groupOptions(appliedTeam.value() ?? []),
      ),
      courseId: find(
        ids.courseId,
        appliedCourse.value() && groupOptions(appliedCourse.value() ?? []),
      ),
      quizId: find(ids.quizId, appliedQuiz.value()),
    };
  });
  const reads = [orgs, appliedTeam, appliedCourse, appliedQuiz];
  const dropdowns = {
    orgId: orgs,
    teamId: teams,
    courseId: courses,
    quizId: quizzes,
  };

  return {
    picks$,
    options$: options,
    loadFailed$: computed(() => byKey((key) => !!dropdowns[key].error())),
    busy$: computed(() => ({
      orgId: orgs.isLoading(),
      teamId: teams.isLoading(),
      courseId: courses.isLoading(),
      quizId: quizzes.isLoading(),
    })),
    /** The option each picker shows: the one picked here, else the URL's once resolved. */
    selected$: computed(() => {
      const picks = picks$(),
        known = state.known(),
        url = resolved(),
        ids = applied();
      return byKey((key): ReportPickerOption | null => {
        const id = picks[key];
        if (id === undefined) return null;
        if (known[key]?.id === id) return known[key];
        if (id === ids[key]) return url[key] ?? null;
        return options[key]().find((o) => o.id === id) ?? null;
      });
    }),
    /** The not-found message of a URL id that is still picked and could not be resolved. */
    errors$: computed(() => {
      const url = resolved(),
        picks = picks$(),
        ids = applied();
      return byKey((key) =>
        url[key] === null && picks[key] === ids[key]
          ? NOT_FOUND[key]
          : undefined,
      );
    }),
    /**
     * True while an id of the URL is not known to be in scope, still resolving or not found: the
     * report waits instead of answering zeros for an id the user cannot see.
     */
    blocked$: computed(() => {
      const url = resolved(),
        ids = applied();
      return KEYS.some((key) => ids[key] !== undefined && !url[key]);
    }),
    /** The first failed read of a URL id; the screen offers to retry it. */
    error$: computed(() => reads.map((read) => read.error()).find(Boolean)),
    retry(): void {
      for (const read of reads) read.reload();
    },
    retryDropdown(key: PickerKey): void {
      dropdowns[key].reload();
    },
    /** Picks an option, or clears the choice with `null`; the pickers under it are cleared. */
    pick(key: PickerKey, option: ReportPickerOption | null): void {
      state.picks.update((picks) => {
        const next = { ...picks, [key]: option?.id };
        for (const child of CHILDREN[key]) next[child] = undefined;
        return next;
      });
      if (option) state.known.update((known) => ({ ...known, [key]: option }));
    },
    /** Clears every picker, as "Đặt lại" does. */
    clear(): void {
      state.picks.set(byKey(() => undefined));
    },
  };
}

export type ReportPickers = ReturnType<typeof reportPickers>;
