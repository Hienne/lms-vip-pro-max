import { inject, Injectable } from '@angular/core';
import { learningReportEndpoints } from '@lms/contracts';
import { EndpointClient } from '../../core/http/endpoint-client';
import { serverData } from '../../core/data-access/server-data';

@Injectable()
export class ManagementDashboardStore {
  private readonly client = inject(EndpointClient);
  private readonly summary = serverData(() =>
    this.client.call(learningReportEndpoints.dashboard),
  );
  readonly summary$ = this.summary.value;
  readonly loading$ = this.summary.isLoading;
  readonly error$ = this.summary.error;
  retry(): void {
    this.summary.reload();
  }
}
