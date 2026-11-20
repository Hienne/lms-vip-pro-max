import { computed, inject, Injectable, signal } from '@angular/core';
import {
  learnerEndpoints,
  learningReportEndpoints,
  MANAGEMENT_DASHBOARD_PERIODS,
  type ManagementDashboardPeriod,
} from '@lms/contracts';
import { EndpointClient } from '../../core/http/endpoint-client';
import { serverData } from '../../core/data-access/server-data';

@Injectable()
export class ManagementDashboardStore {
  private readonly client = inject(EndpointClient);
  private readonly selectedPeriod = signal<ManagementDashboardPeriod>(0);
  readonly periods = MANAGEMENT_DASHBOARD_PERIODS;
  readonly period = this.selectedPeriod.asReadonly();

  private readonly summary = serverData(
    (days: ManagementDashboardPeriod) =>
      this.client.call(learningReportEndpoints.dashboard, { query: { days } }),
    { params: () => this.period() },
  );
  readonly summary$ = this.summary.value;
  readonly loading$ = this.summary.isLoading;
  readonly error$ = this.summary.error;

  readonly leaderboardQuery = { scope: 'all', period: 'month' } as const;
  private readonly leaderboard = serverData(() =>
    this.client.call(learnerEndpoints.leaderboard, {
      query: this.leaderboardQuery,
    }),
  );
  readonly topLearners$ = computed(
    () => this.leaderboard.value()?.top.slice(0, 5) ?? [],
  );
  readonly leaderboardLoading$ = this.leaderboard.isLoading;
  readonly leaderboardError$ = this.leaderboard.error;

  retryLeaderboard(): void {
    this.leaderboard.reload();
  }

  selectPeriod(value: string): void {
    const period = this.periods.find((days) => days === Number(value));
    if (period !== undefined) this.selectedPeriod.set(period);
  }

  retry(): void {
    this.summary.reload();
  }
}
