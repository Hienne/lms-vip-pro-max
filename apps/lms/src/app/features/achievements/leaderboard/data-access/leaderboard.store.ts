import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  LeaderboardScopeSchema,
  learnerEndpoints,
  type LeaderboardQuery,
  type LeaderboardScope,
  type PointParts,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** Rows per page; the server's default, sent so the page count does not depend on it. */
export const LEADERBOARD_PAGE_SIZE = 20;

/** The scope the server uses when none is asked, and the one the URL leaves out. */
export const DEFAULT_SCOPE: LeaderboardScope = 'org';

/** The four sources of points, in the order and the words the mockup lists them. */
const PART_LABELS: readonly { key: keyof PointParts; label: string }[] = [
  { key: 'lessons', label: 'Bài học hoàn thành' },
  { key: 'quizzes', label: 'Bài kiểm tra đạt' },
  { key: 'courses', label: 'Khóa học hoàn thành' },
  { key: 'streak', label: 'Chuỗi ngày học' },
];

export interface PartRow {
  readonly key: keyof PointParts;
  readonly label: string;
  readonly points: number;
}

/** The scope of a shared or reloaded URL; an unknown value is dropped, not an error. */
function scopeFrom(value: unknown): LeaderboardScope {
  const scope = LeaderboardScopeSchema.safeParse(value);
  return scope.success ? scope.data : DEFAULT_SCOPE;
}

/**
 * "Bảng xếp hạng & thành tích" (SPEC-learning-leaderboard): the server's ranking for a scope, one page
 * at a time, and the caller's own points. Points, ranks and ties are the server's; this store only
 * chooses the scope and the page, and keeps them in the URL so a reload or a shared link opens the same
 * board.
 */
@Injectable()
export class LeaderboardStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    scope: signal<LeaderboardScope>(scopeFrom(this.initial['scope'])),
    /** 1-based, as the pagination control counts. */
    page: signal(Math.max(1, Math.floor(Number(this.initial['page'])) || 1)),
  };

  private readonly query = computed(
    (): LeaderboardQuery => ({
      scope: this.state.scope(),
      page: this.state.page() - 1,
      size: LEADERBOARD_PAGE_SIZE,
    }),
  );

  private readonly boardData = serverData(
    (query: LeaderboardQuery) =>
      this.client.call(learnerEndpoints.leaderboard, { query }),
    { params: () => this.query() },
  );

  private readonly pointsData = serverData(() =>
    this.client.call(learnerEndpoints.myPoints),
  );

  // Selectors
  readonly scope$ = this.state.scope.asReadonly();
  readonly page$ = this.state.page.asReadonly();

  readonly boardError$ = this.boardData.error;
  readonly isBoardLoading$ = this.boardData.isLoading;
  readonly rows$ = computed(() => this.boardData.value()?.page.items ?? []);
  readonly total$ = computed(
    () => this.boardData.value()?.page.totalElements ?? 0,
  );
  readonly me$ = computed(() => this.boardData.value()?.me);

  /** The caller is not among the rows shown: another page, or not in the scope at all. */
  readonly isMeOffPage$ = computed(() => {
    const board = this.boardData.value();
    return board !== undefined && !board.page.items.some((row) => row.me);
  });

  /** The scope has no learner to list; only a caller with no team reads `team` and finds it so. */
  readonly isEmpty$ = computed(() => {
    const board = this.boardData.value();
    return board !== undefined && board.page.totalElements === 0;
  });

  readonly pointsError$ = this.pointsData.error;
  readonly isPointsLoading$ = this.pointsData.isLoading;
  readonly points$ = this.pointsData.value;

  /** The caller's rank in the scope shown; null while loading or when they are not in it. */
  readonly rank$ = computed(() => this.boardData.value()?.me.rank ?? null);

  readonly parts$ = computed((): readonly PartRow[] => {
    const points = this.pointsData.value();
    return points
      ? PART_LABELS.map(({ key, label }) => ({
          key,
          label,
          points: points.parts[key],
        }))
      : [];
  });

  // Setters: the only writers of state
  private setScope(scope: LeaderboardScope): void {
    this.state.scope.set(scope);
  }

  private setPage(page: number): void {
    this.state.page.set(page);
  }

  // Commands: a new scope starts again at the first page, and both are written to the URL
  selectScope(value: string): void {
    const scope = LeaderboardScopeSchema.safeParse(value);
    if (!scope.success || scope.data === this.state.scope()) return;
    this.setScope(scope.data);
    this.setPage(1);
    this.syncUrl();
  }

  goToPage(page: number): void {
    this.setPage(page);
    this.syncUrl();
  }

  retryBoard(): void {
    this.boardData.reload();
  }

  retryPoints(): void {
    this.pointsData.reload();
  }

  /** Writes the choices to the query string without a history entry; defaults are left out. */
  private syncUrl(): void {
    const queryParams: Params = {
      scope: this.state.scope() === DEFAULT_SCOPE ? null : this.state.scope(),
      page: this.state.page() > 1 ? this.state.page() : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }
}
