import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
  };

  readonly period$ = this.state.period.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }
}
