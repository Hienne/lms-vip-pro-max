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
  type ArticleListQuery,
  type ContentCard,
  type Page,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { CommunityChanges } from '../../data-access/community-changes';

export const ARTICLES_PAGE_SIZE = 20;

/** "Bài viết" lists articles (C08), "Bài học sự cố" lessons learned (C93). */
export type ArticleType = 'article' | 'lesson';
export type ArticleSort = 'new' | 'score' | 'activity';

/** The backend's `sort` for articles; lessons learned come newest first and take no sort. */
const SORT_PARAM: Record<ArticleSort, string> = {
  new: 'publishedAt',
  score: 'score',
  activity: 'lastActivityAt',
};
const SORTS = Object.keys(SORT_PARAM) as ArticleSort[];

interface ArticleFilters {
  readonly q: string;
  readonly tagId: number | undefined;
}

interface ArticleRequest {
  readonly type: ArticleType;
  readonly query: ArticleListQuery;
}

const idParam = (value: unknown): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

function filtersFrom(params: Params): ArticleFilters {
  return {
    q: typeof params['q'] === 'string' ? params['q'] : '',
    tagId: idParam(params['tag']),
  };
}

/**
 * Articles and lessons learned (CM-04). The server searches and pages; the store keeps the type,
 * filters and sort, mirrored in the URL.
 */
@Injectable()
export class ArticlesStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(CommunityChanges);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    type: signal<ArticleType>(
      this.initial['type'] === 'lesson' ? 'lesson' : 'article',
    ),
    filters: signal<ArticleFilters>(filtersFrom(this.initial)),
    sort: signal<ArticleSort>(
      SORTS.includes(this.initial['sort']) ? this.initial['sort'] : 'new',
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

  private readonly request = computed((): ArticleRequest => {
    const f = this.state.filters();
    const type = this.state.type();
    return {
      type,
      query: {
        page: this.state.page() - 1,
        size: ARTICLES_PAGE_SIZE,
        ...(type === 'article' ? { sort: SORT_PARAM[this.state.sort()] } : {}),
        ...(f.q.trim() ? { q: f.q.trim().slice(0, 300) } : {}),
        ...(f.tagId ? { tagIds: [f.tagId] } : {}),
      },
    };
  });

  private readonly listData = serverData(
    ({ type, query }: ArticleRequest) =>
      this.client.call(
        type === 'lesson'
          ? communityEndpoints.lessons
          : communityEndpoints.articles,
        { query },
      ),
    { params: () => this.request(), reloadOn: this.changes.contents },
  );

  // Selectors
  readonly type$ = this.state.type.asReadonly();
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
    return !!(f.q.trim() || f.tagId);
  });

  // Setters
  private setType(type: ArticleType): void {
    this.state.type.set(type);
  }

  private setFilters(filters: ArticleFilters): void {
    this.state.filters.set(filters);
  }

  private setSort(sort: ArticleSort): void {
    this.state.sort.set(sort);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a changed choice starts again at the first page and is written to the URL
  showType(type: ArticleType): void {
    this.setType(type);
    this.setPage(1);
    this.syncUrl();
  }

  search(q: string): void {
    this.filter({ q });
  }

  filterTag(value: string): void {
    this.filter({ tagId: idParam(value) });
  }

  clearFilters(): void {
    this.setFilters({ q: '', tagId: undefined });
    this.setPage(1);
    this.syncUrl();
  }

  sortBy(value: string): void {
    this.setSort(
      SORTS.includes(value as ArticleSort) ? (value as ArticleSort) : 'new',
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

  private filter(change: Partial<ArticleFilters>): void {
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
        type: this.state.type() === 'lesson' ? 'lesson' : null,
        q: f.q.trim() || null,
        tag: f.tagId ?? null,
        sort: this.state.sort() === 'new' ? null : this.state.sort(),
        page: this.state.page() > 1 ? this.state.page() : null,
      },
      replaceUrl: true,
    });
  }
}
