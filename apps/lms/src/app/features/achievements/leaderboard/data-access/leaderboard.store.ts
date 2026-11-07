import { computed, inject, Injectable, signal } from '@angular/core';
import { ActivatedRoute, Router, type Params } from '@angular/router';
import {
  LeaderboardPeriodSchema,
  LeaderboardScopeSchema,
  MAX_LEADERBOARD_OFFSET,
  learnerEndpoints,
  type LeaderboardPeriod,
  type LeaderboardQuery,
  type LeaderboardScope,
  type PointParts,
} from '@lms/contracts';
import { LOCAL_STORAGE } from '../../../../core/storage/local-storage';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The scope the server uses when none is asked, and the one the URL leaves out. */
export const DEFAULT_SCOPE: LeaderboardScope = 'org';

/** The period the server uses when none is asked, and the one the URL leaves out. */
export const DEFAULT_PERIOD: LeaderboardPeriod = 'month';

/** Where the dismissal of the "points became XP" notice is kept, per browser. */
export const XP_NOTICE_STORAGE_KEY = 'lms.xp-notice-dismissed';

/** The sources of XP. A streak earns none, so it is not a part. */
const PART_LABELS: readonly { key: keyof PointParts; label: string }[] = [
  { key: 'lessons', label: 'Bài học hoàn thành' },
  { key: 'quizzes', label: 'Bài kiểm tra đạt' },
  { key: 'firstTryBonus', label: 'Đạt ngay lần đầu' },
  { key: 'courses', label: 'Khóa học hoàn thành' },
  { key: 'community', label: 'Cộng đồng' },
  { key: 'adjustments', label: 'Điều chỉnh' },
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

/** The period of a shared or reloaded URL; an unknown value is dropped, not an error. */
function periodFrom(value: unknown): LeaderboardPeriod {
  const period = LeaderboardPeriodSchema.safeParse(value);
  return period.success ? period.data : DEFAULT_PERIOD;
}

/** How many periods back a URL asks for; anything but a whole number in range reads as the current one. */
function offsetFrom(value: unknown): number {
  const offset = Number(value);
  return Number.isInteger(offset) &&
    offset > 0 &&
    offset <= MAX_LEADERBOARD_OFFSET
    ? offset
    : 0;
}

/** `2026-11-02` as `02/11`; the server's calendar day, so no time zone is applied. */
function dayMonth(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

/**
 * "Bảng xếp hạng & thành tích" (SPEC-learning-leaderboard): the server's top ten for a scope and a period
 * (week, month, all; stepping back to an earlier one), the caller's own row and the caller's points. XP,
 * ranks, ties and the gap to the person above are the server's; this store only chooses the scope, the
 * period and how far back, and keeps them in the URL so a reload or a shared link opens the same board.
 */
@Injectable()
export class LeaderboardStore {
  private readonly client = inject(EndpointClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storage = inject(LOCAL_STORAGE);

  private readonly initial = this.route.snapshot.queryParams;

  private readonly state = {
    scope: signal<LeaderboardScope>(scopeFrom(this.initial['scope'])),
    period: signal<LeaderboardPeriod>(periodFrom(this.initial['period'])),
    /** Periods back from the current one; always 0 for `all`. */
    offset: signal(
      periodFrom(this.initial['period']) === 'all'
        ? 0
        : offsetFrom(this.initial['offset']),
    ),
  };

  private readonly query = computed(
    (): LeaderboardQuery => ({
      scope: this.state.scope(),
      period: this.state.period(),
      offset: this.state.offset(),
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

  private readonly noticeDismissed = signal(this.readNoticeDismissed());

  // Selectors
  /** The one-time notice that points became XP and a streak no longer earns any. */
  readonly isXpNoticeShown$ = computed(() => !this.noticeDismissed());
  readonly scope$ = this.state.scope.asReadonly();
  readonly period$ = this.state.period.asReadonly();
  readonly offset$ = this.state.offset.asReadonly();
  /** An earlier period can be stepped back from, until the server's limit; `all` has none. */
  readonly canStepBack$ = computed(
    () =>
      this.state.period() !== 'all' &&
      this.state.offset() < MAX_LEADERBOARD_OFFSET,
  );
  readonly canStepForward$ = computed(
    () => this.state.period() !== 'all' && this.state.offset() > 0,
  );

  readonly boardError$ = this.boardData.error;
  readonly isBoardLoading$ = this.boardData.isLoading;
  /** The top ten, in the server's order. */
  readonly top$ = computed(() => this.boardData.value()?.top ?? []);
  readonly me$ = computed(() => this.boardData.value()?.me);

  /** The one or two just above the caller, when the caller is outside the top ten. */
  readonly above$ = computed(() => this.boardData.value()?.above ?? []);

  /** XP the caller lacks to pass the nearest person with more; null in the top ten or with no one above. */
  readonly gapToAbove$ = computed(
    () => this.boardData.value()?.gapToAbove ?? null,
  );

  /** The caller is in the top ten (their row is highlighted in place) rather than shown below it. */
  readonly isMeInTop$ = computed(
    () => this.boardData.value()?.top.some((row) => row.me) ?? false,
  );

  /** The caller's row is shown below the top ten: outside it, or in no ranking at all (a rank of null). */
  readonly isMeBelowTop$ = computed(
    () => this.boardData.value() !== undefined && !this.isMeInTop$(),
  );

  /** The scope has no learner to list; only a caller with no team reads `team` and finds it so. */
  readonly isEmpty$ = computed(() => {
    const board = this.boardData.value();
    return board !== undefined && board.top.length === 0;
  });

  /** The span the board covers: the month, the week's days, or all time. */
  readonly periodLabel$ = computed(() => {
    const board = this.boardData.value();
    if (board === undefined || board.from === null || board.to === null) {
      return this.state.period() === 'all' ? 'Tất cả thời gian' : '';
    }
    if (board.period === 'month') {
      const [year, month] = board.from.split('-');
      return `Tháng ${Number(month)}/${year}`;
    }
    return `${dayMonth(board.from)} – ${dayMonth(board.to)}`;
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

  dismissXpNotice(): void {
    this.noticeDismissed.set(true);
    try {
      this.storage?.setItem(XP_NOTICE_STORAGE_KEY, '1');
    } catch {
      // Storage can be full or blocked: the notice is gone for this visit only.
    }
  }

  private readNoticeDismissed(): boolean {
    try {
      return this.storage?.getItem(XP_NOTICE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  // Setters: the only writers of state
  private setScope(scope: LeaderboardScope): void {
    this.state.scope.set(scope);
  }

  private setPeriod(period: LeaderboardPeriod): void {
    this.state.period.set(period);
  }

  private setOffset(offset: number): void {
    this.state.offset.set(offset);
  }

  // Commands: a new scope or period starts at the current one, and the choices are written to the URL
  selectScope(value: string): void {
    const scope = LeaderboardScopeSchema.safeParse(value);
    if (!scope.success || scope.data === this.state.scope()) return;
    this.setScope(scope.data);
    this.syncUrl();
  }

  selectPeriod(value: string): void {
    const period = LeaderboardPeriodSchema.safeParse(value);
    if (!period.success || period.data === this.state.period()) return;
    this.setPeriod(period.data);
    this.setOffset(0);
    this.syncUrl();
  }

  /** One period earlier: last week, last month, and on back. */
  stepBack(): void {
    if (!this.canStepBack$()) return;
    this.setOffset(this.state.offset() + 1);
    this.syncUrl();
  }

  /** One period later, back towards the current one. */
  stepForward(): void {
    if (!this.canStepForward$()) return;
    this.setOffset(this.state.offset() - 1);
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
      period:
        this.state.period() === DEFAULT_PERIOD ? null : this.state.period(),
      offset: this.state.offset() > 0 ? this.state.offset() : null,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }
}
