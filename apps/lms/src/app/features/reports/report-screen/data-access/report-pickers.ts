import {
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import { map } from 'rxjs';
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

/** The most groups one picker lists; the backend's page limit. */
const LIMIT = 100;

/** A group as an option. A course group is named by its title alone: the report carries no code. */
const groupOption = (group: LearningReportGroup): ReportPickerOption => ({
  id: Number(group.id),
  name: group.name ?? group.id,
});

/** A quiz of the exam overview; a group with no quiz id is not one that can be picked. */
const quizOption = (quiz: {
  id: number | null;
  name: string | null;
}): ReportPickerOption[] =>
  quiz.id === null ? [] : [{ id: quiz.id, name: quiz.name ?? `#${quiz.id}` }];

const matches = (option: ReportPickerOption, query: string): boolean => {
  const q = query.trim().toLocaleLowerCase('vi');
  return (
    !q ||
    `${option.meta ?? ''} ${option.name}`.toLocaleLowerCase('vi').includes(q)
  );
};

const pick = (filters: ReportFilters): Picks => ({
  orgId: filters.orgId,
  teamId: filters.teamId,
  courseId: filters.courseId,
  quizId: filters.quizId,
});

/**
 * The report filter pickers. Their options come from the report endpoints themselves, which every
 * report role may read and which the server scopes: units and teams from the learning report
 * groups, courses from its course groups (searched on the server), quizzes from the exam overview
 * of the picked course. The ids the URL applies are resolved through the same reads; one that
 * cannot be (not found, or outside the caller's scope) blocks the report.
 *
 * Call it in a store's field initializer, with the filters the URL applies.
 */
export function reportPickers(applied: Signal<ReportFilters>) {
  const client = inject(EndpointClient);
  const groups = (query: LearningReportGroupQuery) =>
    client
      .call(learning.groups, { query: { size: LIMIT, ...query } })
      .pipe(map((page) => page.items));

  const state = {
    /** The ids picked in the form, until "Áp dụng bộ lọc" writes them to the URL. */
    picks: linkedSignal<Picks>(() => pick(applied())),
    /** The options picked in this visit, so their names show before any read answers. */
    known: signal<Partial<Record<PickerKey, ReportPickerOption>>>({}),
    queries: signal<Record<PickerKey, string>>({
      orgId: '',
      teamId: '',
      courseId: '',
      quizId: '',
    }),
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
        q: state.queries().courseId.trim() || undefined,
      }),
    },
  );
  const quizzes = serverData(
    (courseId: number) =>
      client
        .call(assessment.overview, { query: { courseId } })
        .pipe(map((overview) => overview.byQuiz)),
    { params: () => picks$().courseId },
  );

  // The URL's ids, each read on its own so a shared link shows names before anything is picked.
  const appliedTeam = serverData(
    (teamId: number) => groups({ groupBy: 'team', teamId }),
    { params: () => applied().teamId },
  );
  const appliedCourse = serverData(
    (courseId: number) => groups({ groupBy: 'course', courseId }),
    { params: () => applied().courseId },
  );
  const appliedQuiz = serverData(
    (query: { quizId: number; courseId?: number }) =>
      client
        .call(assessment.overview, { query })
        .pipe(map((overview) => overview.byQuiz)),
    {
      params: () => {
        const { quizId, courseId } = applied();
        return quizId ? { quizId, courseId } : undefined;
      },
    },
  );

  const options: Record<PickerKey, Signal<readonly ReportPickerOption[]>> = {
    orgId: computed(() => (orgs.value() ?? []).map(groupOption)),
    teamId: computed(() => (teams.value() ?? []).map(groupOption)),
    courseId: computed(() => (courses.value() ?? []).map(groupOption)),
    quizId: computed(() => (quizzes.value() ?? []).flatMap(quizOption)),
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
      teamId: find(ids.teamId, appliedTeam.value()?.map(groupOption)),
      courseId: find(ids.courseId, appliedCourse.value()?.map(groupOption)),
      quizId: find(ids.quizId, appliedQuiz.value()?.flatMap(quizOption)),
    };
  });
  const reads = [orgs, appliedTeam, appliedCourse, appliedQuiz];

  return {
    picks$,
    options$: options,
    /** The options matching what is typed in each box; courses are searched on the server. */
    matches$: computed(() => {
      const queries = state.queries();
      return byKey((key) =>
        key === 'courseId'
          ? options.courseId()
          : options[key]().filter((option) => matches(option, queries[key])),
      );
    }),
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
    /** Picks an option, or clears the choice with `null`; the pickers under it are cleared. */
    pick(key: PickerKey, option: ReportPickerOption | null): void {
      state.picks.update((picks) => {
        const next = { ...picks, [key]: option?.id };
        for (const child of CHILDREN[key]) next[child] = undefined;
        return next;
      });
      if (option) state.known.update((known) => ({ ...known, [key]: option }));
    },
    search(key: PickerKey, query: string): void {
      state.queries.update((queries) => ({ ...queries, [key]: query }));
    },
  };
}

export type ReportPickers = ReturnType<typeof reportPickers>;
