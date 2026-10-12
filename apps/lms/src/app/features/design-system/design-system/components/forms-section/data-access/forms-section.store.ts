import { Injectable, signal } from '@angular/core';

@Injectable()
export class FormsSectionStore {
  private readonly state = {
    summaryShown: signal(false),
    searchQuery: signal(''),
  };

  readonly summaryShown$ = this.state.summaryShown.asReadonly();
  readonly searchQuery$ = this.state.searchQuery.asReadonly();

  setSummaryShown(shown: boolean): void {
    this.state.summaryShown.set(shown);
  }

  setSearchQuery(query: string): void {
    this.state.searchQuery.set(query);
  }

  showSummary(): void {
    this.setSummaryShown(true);
  }

  hideSummary(): void {
    this.setSummaryShown(false);
  }
}
