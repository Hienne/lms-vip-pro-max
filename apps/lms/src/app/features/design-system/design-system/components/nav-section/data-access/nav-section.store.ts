import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    tab: signal('overview'),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly tab$ = this.state.tab.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }

  setTab(tab: string): void {
    this.state.tab.set(tab);
  }
}
