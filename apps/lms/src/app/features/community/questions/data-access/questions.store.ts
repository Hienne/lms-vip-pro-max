import {
  computed,
  inject,
  Injectable,
  linkedSignal,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  communityEndpoints,
  ResolutionStatusSchema,
  type ContentCard,
  type Page,
  type QuestionListQuery,
  type ResolutionStatus,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';

export const QUESTIONS_PAGE_SIZE = 20;

export type QuestionSort = 'activity' | 'score' | 'new';

/** The backend's `sort` for each choice; the server always sorts descending. */
const SORT_PARAM: Record<QuestionSort, string> = {
  activity: 'lastActivityAt',
  score: 'score',
  new: 'publishedAt',
};
const SORTS = Object.keys(SORT_PARAM) as QuestionSort[];

interface QuestionFilters {
  readonly q: string;
  readonly tagId: number | undefined;
  readonly resolution: ResolutionStatus | '';
}

const NO_FILTERS: QuestionFilters = { q: '', tagId: undefined, resolution: '' };

const idParam = (value: unknown): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

function filtersFrom(params: Params): QuestionFilters {
  const resolution = ResolutionStatusSchema.safeParse(params['status']);
  return {
    q: typeof params['q'] === 'string' ? params['q'] : '',
    tagId: idParam(params['tag']),
    resolution: resolution.success ? resolution.data : '',
  };
}

/**
 * The question list (CM-01). The server searches, filters, sorts and pages; the store keeps the
 * choices, mirrored in the URL so a reload or a shared link opens the same list.
 */
@Injectable()
export class QuestionsStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    filters: signal<QuestionFilters>(filtersFrom(this.initial)),
    sort: signal<QuestionSort>(
      SORTS.includes(this.initial['sort']) ? this.initial['sort'] : 'activity',
    ),
    page: signal(Math.max(1, Number(this.initial['page']) || 1)),
    /** The last page the server sent: the list stays while the next one loads. */
    shown: linkedSignal<
      Page<ContentCard> | undefined,
      Page<ContentCard> | undefined
    >({
      source: () => this.listData.value(),
      computation: (next, previous) => next ?? previous?.value,
    }),
  };

  private readonly query = computed((): QuestionListQuery => {
    const f = this.state.filters();
    return {
      page: this.state.page() - 1,
      size: QUESTIONS_PAGE_SIZE,
      sort: SORT_PARAM[this.state.sort()],
      ...(f.q.trim() ? { q: f.q.trim().slice(0, 300) } : {}),
      ...(f.tagId ? { tagIds: [f.tagId] } : {}),
      ...(f.resolution ? { resolutionStatus: f.resolution } : {}),
    };
  });

  private readonly listData = serverData(
    (query: QuestionListQuery) =>
      this.client.call(communityEndpoints.questions, { query }),
    { params: () => this.query(), reloadOn: this.changes.contents },
  );

  // Selectors
  readonly filters$ = this.state.filters.asReadonly();
  readonly sort$ = this.state.sort.asReadonly();
  readonly page$ = this.state.page.asReadonly();
  readonly cards$ = computed(() => this.state.shown()?.items ?? []);
  readonly total$ = computed(() => this.state.shown()?.totalElements ?? 0);
  readonly isLoading$ = computed(
    () => this.listData.isLoading() && this.state.shown() === undefined,
  );
  readonly loadError$ = this.listData.error;
  readonly isFiltered$ = computed(() => {
    const f = this.state.filters();
    return !!(f.q.trim() || f.tagId || f.resolution);
  });

  // Setters
  private setFilters(filters: QuestionFilters): void {
    this.state.filters.set(filters);
  }

  private setSort(sort: QuestionSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed choice starts again at the first page and is written to the URL
  search(q: string): void {
    this.filter({ q });
  }

  filterTag(value: string): void {
    this.filter({ tagId: idParam(value) });
  }

  filterResolution(value: ResolutionStatus | ''): void {
    this.filter({ resolution: value });
  }

  clearFilters(): void {
    this.setFilters(NO_FILTERS);
    this.setPage(1);
    this.syncUrl();
  }

  sortBy(value: string): void {
    this.setSort(
      SORTS.includes(value as QuestionSort)
        ? (value as QuestionSort)
        : 'activity',
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

  private filter(change: Partial<QuestionFilters>): void {
    this.setFilters({ ...this.state.filters(), ...change });
    this.setPage(1);
    this.syncUrl();
  }

  /** Writes the choices to the query string without a history entry; defaults are left out. */
  private syncUrl(): void {
    const f = this.state.filters();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: f.q.trim() || null,
        tag: f.tagId ?? null,
        status: f.resolution || null,
        sort: this.state.sort() === 'activity' ? null : this.state.sort(),
        page: this.state.page() > 1 ? this.state.page() : null,
      },
      replaceUrl: true,
    });
  }
}
