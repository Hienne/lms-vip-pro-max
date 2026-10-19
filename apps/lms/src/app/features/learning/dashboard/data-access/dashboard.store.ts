import { computed, inject, Injectable, signal } from '@angular/core';
import { learningDashboardEndpoints } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { LearningChanges } from '../../../../core/data-access/learning-changes';
import { EndpointClient } from '../../../../core/http/endpoint-client';

@Injectable()
export class DashboardStore {
  private readonly client = inject(EndpointClient);
  private readonly changes = inject(LearningChanges);
  private readonly state = { tab: signal('inProgress') };
  private readonly data = serverData(
    () => this.client.call(learningDashboardEndpoints.dashboard),
    { reloadOn: this.changes.results },
  );
  readonly dashboard$ = this.data.value;
  readonly isLoading$ = this.data.isLoading;
  readonly error$ = this.data.error;
  readonly tab$ = this.state.tab.asReadonly();
  readonly courses$ = computed(() => {
    const items = this.dashboard$()?.cards ?? [];
    const tab = this.tab$();
    if (tab === 'required') return items.filter((item) => item.required);
    if (tab === 'assigned') return items.filter((item) => item.assigned);
    if (tab === 'notStarted')
      return items.filter((item) => item.status === 'not_started');
    if (tab === 'completed')
      return items.filter((item) => item.status === 'completed');
    return items.filter(
      (item) => item.status === 'in_progress' || item.status === 'failed',
    );
  });
  setTab(tab: string): void {
    this.state.tab.set(tab);
  }
  retry(): void {
    this.data.reload();
  }
}
