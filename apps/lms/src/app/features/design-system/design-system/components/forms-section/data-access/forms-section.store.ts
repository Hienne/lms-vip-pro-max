import { Injectable, signal } from '@angular/core';

@Injectable()
export class FormsSectionStore {
  private readonly state = {
    summaryShown: signal(false),
  };

  readonly summaryShown$ = this.state.summaryShown.asReadonly();

  setSummaryShown(shown: boolean): void {
    this.state.summaryShown.set(shown);
  }

  showSummary(): void {
    this.setSummaryShown(true);
  }

  hideSummary(): void {
    this.setSummaryShown(false);
  }
}
