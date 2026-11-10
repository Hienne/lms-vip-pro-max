import {
  computed,
  inject,
  Injectable,
  Injector,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  CourseLevelSchema,
  learnerEndpoints,
  RequirementSchema,
  type CourseCard,
  type CourseLevel,
  type LearnerCatalogQuery,
  type Page,
  type Requirement,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import type { CourseCardView } from '../../../../shared/course/course-card';
import { toCourseCardView } from '../../../../shared/course/course-card-view';
import { coverPreviews } from '../../../../shared/course/cover-image';

export const CATALOG_PAGE_SIZE = 12;

/** "Tất cả" lists the catalogue, "Được giao" the caller's own courses. */
export type CatalogScope = 'all' | 'assigned';
export type CatalogSort = 'due' | 'progress' | 'name';

/**
 * The mockup's single "Trạng thái" choice. `failed`, `overdue` and `assigned` are flags the server
 * evaluates, not learning statuses, so each becomes its own query flag.
 */
export const STATUS_FILTERS = [
  'not_started',
  'in_progress',
  'completed',
  'failed',
  'overdue',
  'assigned',
] as const;
export type StatusFilter = '' | (typeof STATUS_FILTERS)[number];

const STATUS_QUERY: Record<
  (typeof STATUS_FILTERS)[number],
  Pick<
    LearnerCatalogQuery,
    'learningStatus' | 'failed' | 'overdue' | 'assigned'
  >
> = {
  not_started: { learningStatus: 'not_started' },
  in_progress: { learningStatus: 'in_progress' },
  completed: { learningStatus: 'completed' },
  failed: { failed: true },
  overdue: { overdue: true },
  assigned: { assigned: true },
};

/** The backend's `sort` for each choice of the "Sắp xếp" select. */
const SORT_PARAM: Record<CatalogSort, string> = {
  due: 'dueAt,asc',
  progress: 'progressPercent,desc',
  name: 'title,asc',
};

const SORTS = Object.keys(SORT_PARAM) as CatalogSort[];
interface CatalogFilters {
  readonly q: string;
  readonly fieldId: number | undefined;
  readonly moduleId: number | 'unclassified' | undefined;
  readonly programId: number | undefined;
  readonly level: CourseLevel | '';
  readonly requirement: Requirement | '';
  readonly status: StatusFilter;
}

const NO_FILTERS: CatalogFilters = {
  q: '',
  fieldId: undefined,
  moduleId: undefined,
  programId: undefined,
  level: '',
  requirement: '',
  status: '',
};

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

const moduleParam = (value: string) =>
  value === 'unclassified' ? value : idParam(value);

/** The filters a shared or reloaded URL carries; an unknown value is dropped, not an error. */
function filtersFrom(params: Params): CatalogFilters {
  const text = (key: string): string =>
    typeof params[key] === 'string' ? params[key] : '';
  const level = CourseLevelSchema.safeParse(params['level']);
  const requirement = RequirementSchema.safeParse(params['requirement']);
  const status = STATUS_FILTERS.find((s) => s === text('status'));
  return {
    q: text('q'),
    fieldId: idParam(text('field')),
    moduleId: moduleParam(text('module')),
    programId: idParam(text('program')),
    level: level.success ? level.data : '',
    requirement: requirement.success ? requirement.data : '',
    status: status ?? '',
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
  private readonly injector = inject(Injector);
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

  private readonly request = computed((): LearnerCatalogQuery => {
    const f = this.state.filters();
    return {
      page: this.state.page() - 1,
      size: CATALOG_PAGE_SIZE,
      sort: SORT_PARAM[this.state.sort()],
      // "Được giao" is the catalogue narrowed to what the caller has an assignment for.
      ...(this.state.scope() === 'assigned' ? { assigned: true } : {}),
      ...(f.q.trim() ? { q: f.q.trim().slice(0, 100) } : {}),
      ...(f.fieldId ? { fieldId: f.fieldId } : {}),
      ...(f.moduleId === 'unclassified'
        ? { withoutModule: true }
        : f.moduleId
          ? { moduleId: f.moduleId }
          : {}),
      ...(f.programId ? { programId: f.programId } : {}),
      ...(f.level ? { level: f.level } : {}),
      ...(f.requirement ? { requirement: f.requirement } : {}),
      ...(f.status ? STATUS_QUERY[f.status] : {}),
    };
  });

  private readonly listData = serverData(
    (query: LearnerCatalogQuery) =>
      this.client.call(learnerEndpoints.catalog, { query }),
    { params: () => this.request() },
  );

  /** The names the selects offer: only those the caller's visible courses use. */
  private readonly facetsData = serverData(() =>
    this.client.call(learnerEndpoints.facets),
  );

  // Selectors
  readonly scope$ = this.state.scope.asReadonly();
  readonly filters$ = this.state.filters.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly fields$ = computed(() => this.facetsData.value()?.fields ?? []);
  /** Programmes and modules of the chosen field; all of them while none is chosen. */
  readonly programs$ = computed(() =>
    this.ofChosenField(this.facetsData.value()?.programs ?? []),
  );
  readonly modules$ = computed(() =>
    this.ofChosenField(this.facetsData.value()?.modules ?? []),
  );
  readonly hasUnclassifiedModule$ = computed(() => {
    const { fieldId, moduleId } = this.state.filters();
    const fields = this.facetsData.value()?.fieldsWithUnclassifiedCourses ?? [];
    return (
      moduleId === 'unclassified' ||
      (fieldId ? fields.includes(fieldId) : fields.length > 0)
    );
  });

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

  /** The covers of the page's cards, read once each while the page lives. */
  private readonly covers = coverPreviews(this.client, this.injector, () =>
    (this.state.shown()?.items ?? []).map((card) => card.coverAssetId),
  );

  readonly cards$ = computed((): readonly CourseCardView[] =>
    (this.state.shown()?.items ?? []).map((card) =>
      toCourseCardView(
        card,
        card.coverAssetId == null
          ? undefined
          : this.covers().get(card.coverAssetId),
      ),
    ),
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

  /** A new field clears the module and the programme, which belong to the old one. */
  filterField(value: string): void {
    this.filter({
      fieldId: idParam(value),
      moduleId: undefined,
      programId: undefined,
    });
  }

  filterModule(value: string): void {
    this.filter({ moduleId: moduleParam(value) });
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
    this.filter({ status: STATUS_FILTERS.find((s) => s === value) ?? '' });
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

  private ofChosenField<T extends { readonly fieldId: number }>(
    items: readonly T[],
  ): readonly T[] {
    const fieldId = this.state.filters().fieldId;
    return fieldId ? items.filter((item) => item.fieldId === fieldId) : items;
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
      status: f.status || null,
      sort: this.state.sort() === 'due' ? null : this.state.sort(),
      page: this.state.page() > 1 ? this.state.page() : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }
}
