import { computed, inject, Injectable } from '@angular/core';
import { personalEndpoints, learningDashboardEndpoints } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { EndpointClient } from '../../../../core/http/endpoint-client';
@Injectable()
export class ProgressStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(LearningChanges);
  private readonly data = serverData(
    () => this.client.call(personalEndpoints.progress),
    { reloadOn: this.changes.results },
  );
  private readonly dashboard = serverData(
    () => this.client.call(learningDashboardEndpoints.dashboard),
    { reloadOn: this.changes.results },
  );
  readonly dashboard$ = this.dashboard.value;
  readonly earnedCount$ = computed(
    () => this.badges$().filter((b) => b.earned).length,
  );
  readonly data$ = this.data.value;
  readonly badges$ = computed(() => this.data.value()?.badges ?? []);
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  retry(): void {
    this.data.reload();
    this.dashboard.reload();
  }
}
