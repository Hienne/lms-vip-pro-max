import { computed, inject, Injectable, signal } from '@angular/core';
import {
  gamificationEndpoints,
  learningReportEndpoints,
  type ImpactQuery,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/** The unit picker lists at most this many units of the caller's scope. */
const UNIT_LIMIT = 100;

/**
 * The gamification impact report: aggregates for the learners in the caller's scope over a period, and the
 * same figures as a CSV. The scope is the server's; a unit chosen outside it simply gives no learners. The
 * period and unit are applied when the user presses the filter button.
 */
@Injectable()
export class GamificationImpactStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);

  private readonly state = {
    /** The filters the report was last asked for; empty means the server's default period. */
    applied: signal<ImpactQuery>({}),
  };

  private readonly report = serverData(
    (query: ImpactQuery) =>
      this.client.call(gamificationEndpoints.impact, { query }),
    { params: () => this.state.applied() },
  );
  private readonly units = serverData(() =>
    this.client.call(learningReportEndpoints.groups, {
      query: { groupBy: 'org', size: UNIT_LIMIT },
    }),
  );
  private readonly exportMutation = serverMutation(
    (query: ImpactQuery) =>
      this.client.call(gamificationEndpoints.exportImpact, { query }),
    {
      errors: 'toast',
      success: () => 'Đã xuất báo cáo CSV',
      onSuccess: (blob) => this.saver.save(blob, 'tac-dong-gamification.csv'),
    },
  );

  readonly report$ = this.report.value;
  readonly isLoading$ = this.report.isLoading;
  readonly error$ = this.report.error;
  readonly unitOptions$ = computed(() =>
    (this.units.value()?.items ?? []).map((unit) => ({
      id: unit.id,
      name: unit.name ?? unit.id,
    })),
  );
  readonly isExporting$ = this.exportMutation.isPending;
  /** The CSV holds the figures of the report on screen, so it waits for one. */
  readonly canExport$ = computed(() => !!this.report.value());

  // Setters: the only writers of state
  private setApplied(query: ImpactQuery): void {
    this.state.applied.set(query);
  }

  // Commands
  apply(query: ImpactQuery): void {
    this.setApplied(query);
  }

  exportCsv(): void {
    if (!this.exportMutation.isPending()) {
      this.exportMutation.run(this.state.applied());
    }
  }

  retry(): void {
    this.report.reload();
    this.units.reload();
  }
}
