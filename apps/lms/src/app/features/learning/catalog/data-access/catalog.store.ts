import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  CourseLevelSchema,
  learnerEndpoints,
  RequirementSchema,
  trainingCatalogEndpoints,
  type CourseCard,
  type CourseLevel,
  type CourseListQuery,
  type Page,
  type Requirement,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import type { CourseCardView } from '../../../../shared/course/course-card';
import {
  COURSE_STATUS_LABEL,
  LEVEL_LABEL,
  toCourseStatus,
} from '../../../../shared/course/course-labels';

export const CATALOG_PAGE_SIZE = 12;

/** "Tất cả" lists the catalogue, "Được giao" the caller's own courses. */
export type CatalogScope = 'all' | 'assigned';
export type CatalogSort = 'due' | 'progress' | 'name';
export type LearningStatusFilter =
  | ''
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'overdue';

/** The backend's `sort` for each choice of the "Sắp xếp" select. */
const SORT_PARAM: Record<CatalogSort, string> = {
  due: 'dueAt,asc',
  progress: 'progressPercent,desc',
  name: 'title,asc',
};

const SORTS = Object.keys(SORT_PARAM) as CatalogSort[];
const STATUSES: readonly LearningStatusFilter[] = [
  'not_started',
  'in_progress',
  'completed',
  'failed',
  'overdue',
];

interface CatalogFilters {
  readonly q: string;
  readonly fieldId: number | undefined;
  readonly moduleId: number | undefined;
  readonly programId: number | undefined;
  readonly level: CourseLevel | '';
  readonly requirement: Requirement | '';
  readonly learningStatus: LearningStatusFilter;
}

const NO_FILTERS: CatalogFilters = {
  q: '',
  fieldId: undefined,
  moduleId: undefined,
  programId: undefined,
  level: '',
  requirement: '',
  learningStatus: '',
};

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

/** The filters a shared or reloaded URL carries; an unknown value is dropped, not an error. */
function filtersFrom(params: Params): CatalogFilters {
  const text = (key: string): string =>
    typeof params[key] === 'string' ? params[key] : '';
  const level = CourseLevelSchema.safeParse(params['level']);
  const requirement = RequirementSchema.safeParse(params['requirement']);
  const status = text('status') as LearningStatusFilter;
  return {
    q: text('q'),
    fieldId: idParam(text('field')),
    moduleId: idParam(text('module')),
    programId: idParam(text('program')),
    level: level.success ? level.data : '',
    requirement: requirement.success ? requirement.data : '',
    learningStatus: STATUSES.includes(status) ? status : '',
  };
}

/**
 * The learner's course catalogue (the mockup's `catalog` page). The server filters, sorts, pages
 * and computes progress and due dates; the store keeps the choices, mirrored in the URL so a
 * reload or a shared link opens the same list.
 */
@Injectable()
export class CatalogStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    scope: signal<CatalogScope>(
      this.initial['scope'] === 'assigned' ? 'assigned' : 'all',
    ),
    filters: signal<CatalogFilters>(filtersFrom(this.initial)),
    sort: signal<CatalogSort>(
      SORTS.includes(this.initial['sort']) ? this.initial['sort'] : 'due',
    ),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
    /** The last page the server sent: the grid stays while the next one loads. */
    shown: linkedSignal<
      Page<CourseCard> | undefined,
      Page<CourseCard> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  /** Fields and programs are listed per owner org: the caller's own. */
  private readonly orgId = computed(() => this.session.user$()?.org?.id);

  private readonly request = computed(
    (): { scope: CatalogScope; query: CourseListQuery } => {
      const f = this.state.filters();
      return {
        scope: this.state.scope(),
        query: {
          page: this.state.page() - 1,
          size: CATALOG_PAGE_SIZE,
          sort: SORT_PARAM[this.state.sort()],
          ...(f.q.trim() ? { q: f.q.trim().slice(0, 100) } : {}),
          ...(f.fieldId ? { fieldId: f.fieldId } : {}),
          ...(f.moduleId ? { moduleId: f.moduleId } : {}),
          ...(f.programId ? { programId: f.programId } : {}),
          ...(f.level ? { level: f.level } : {}),
          ...(f.requirement ? { requirement: f.requirement } : {}),
          ...(f.learningStatus ? { learningStatus: f.learningStatus } : {}),
        },
      };
    },
  );

  private readonly listData = serverData(
    ({ scope, query }: { scope: CatalogScope; query: CourseListQuery }) =>
      this.client.call(
        scope === 'assigned'
          ? learnerEndpoints.myCourses
          : learnerEndpoints.catalog,
        { query },
      ),
    { params: () => this.request() },
  );

  private readonly fieldsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listFields, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.orgId() },
  );

  private readonly programsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(trainingCatalogEndpoints.listPrograms, {
        query: { ownerOrgId, size: 100 },
      }),
    { params: () => this.orgId() },
  );

  private readonly modulesData = serverData(
    (fieldId: number) =>
      this.client.call(trainingCatalogEndpoints.listModules, {
        query: { fieldId, size: 100 },
      }),
    { params: () => this.state.filters().fieldId },
  );

  // Selectors
  readonly scope$ = this.state.scope.asReadonly();
  readonly filters$ = this.state.filters.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly fields$ = computed(() => this.fieldsData.value()?.items ?? []);
  readonly programs$ = computed(() => this.programsData.value()?.items ?? []);
  readonly modules$ = computed(() =>
    this.state.filters().fieldId ? (this.modulesData.value()?.items ?? []) : [],
  );

  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);

  /** How many filters are on, for "Xóa n bộ lọc". */
  readonly activeFilters$ = computed(
    () =>
      Object.values(this.state.filters()).filter(
        (value) => value !== '' && value !== undefined,
      ).length,
  );

  private readonly programNames = computed(
    () => new Map(this.programs$().map((p) => [p.id, p.name])),
  );

  readonly cards$ = computed((): readonly CourseCardView[] =>
    (this.state.shown()?.items ?? []).map((card) => this.toView(card)),
  );

  // Setters: the only writers of state
  private setScope(scope: CatalogScope): void {
    this.state.scope.set(scope);
  }

  private setFilters(filters: CatalogFilters): void {
    this.state.filters.set(filters);
  }

  private setSort(sort: CatalogSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed choice starts again at the first page and is written to the URL
  showScope(scope: CatalogScope): void {
    this.setScope(scope);
    this.setPage(1);
    this.syncUrl();
  }

  search(q: string): void {
    this.filter({ q });
  }

  /** A new field clears the module, which belongs to the old one. */
  filterField(value: string): void {
    this.filter({ fieldId: idParam(value), moduleId: undefined });
  }

  filterModule(value: string): void {
    this.filter({ moduleId: idParam(value) });
  }

  filterProgram(value: string): void {
    this.filter({ programId: idParam(value) });
  }

  filterLevel(value: string): void {
    const level = CourseLevelSchema.safeParse(value);
    this.filter({ level: level.success ? level.data : '' });
  }

  filterRequirement(value: string): void {
    const requirement = RequirementSchema.safeParse(value);
    this.filter({ requirement: requirement.success ? requirement.data : '' });
  }

  filterStatus(value: string): void {
    const status = value as LearningStatusFilter;
    this.filter({ learningStatus: STATUSES.includes(status) ? status : '' });
  }

  clearFilters(): void {
    this.setFilters(NO_FILTERS);
    this.setPage(1);
    this.syncUrl();
  }

  sortBy(value: string): void {
    this.setSort(
      SORTS.includes(value as CatalogSort) ? (value as CatalogSort) : 'due',
    );
    this.setPage(1);
    this.syncUrl();
  }

  goToPage(page: number): void {
    this.setPage(page);
    this.syncUrl();
  }

  retryLoad(): void {
    this.listData.reload();
  }

  private filter(change: Partial<CatalogFilters>): void {
    this.setFilters({ ...this.state.filters(), ...change });
    this.setPage(1);
    this.syncUrl();
  }

  /** Writes the choices to the query string without a history entry; defaults are left out. */
  private syncUrl(): void {
    const f = this.state.filters();
    const queryParams: Params = {
      scope: this.state.scope() === 'assigned' ? 'assigned' : null,
      q: f.q.trim() || null,
      field: f.fieldId ?? null,
      module: f.moduleId ?? null,
      program: f.programId ?? null,
      level: f.level || null,
      requirement: f.requirement || null,
      status: f.learningStatus || null,
      sort: this.state.sort() === 'due' ? null : this.state.sort(),
      page: this.state.page() > 1 ? this.state.page() : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  /** A server row as the course card shows it; every number is the server's. */
  private toView(card: CourseCard): CourseCardView {
    const status = toCourseStatus(card.learningStatus);
    return {
      id: String(card.courseId),
      title: card.title || card.code,
      required: card.requirement === 'mandatory',
      domain:
        (card.programId && this.programNames().get(card.programId)) ||
        'Khóa học',
      module: card.code,
      minutes: Math.round((card.durationSeconds ?? 0) / 60),
      lessons: card.lessonCount ?? 0,
      level: card.level ? LEVEL_LABEL[card.level] : '',
      pct: Math.round(card.progressPercent ?? 0),
      status,
      statusLabel: card.enrollmentId
        ? COURSE_STATUS_LABEL[status]
        : 'Chưa đăng ký',
      overdue: card.overdue ?? false,
      dueAt: card.dueAt ?? null,
      link: `/course/${card.courseId}`,
    };
  }
}
