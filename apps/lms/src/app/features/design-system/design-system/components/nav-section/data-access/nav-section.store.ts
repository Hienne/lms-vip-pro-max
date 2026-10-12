import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    tab: signal('overview'),
    step: signal(1),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly tab$ = this.state.tab.asReadonly();
  readonly step$ = this.state.step.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }

  setTab(tab: string): void {
    this.state.tab.set(tab);
  }

  setStep(step: number): void {
    this.state.step.set(step);
  }
}
