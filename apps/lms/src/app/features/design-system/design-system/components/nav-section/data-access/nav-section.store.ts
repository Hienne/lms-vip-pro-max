import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    step: signal(1),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly step$ = this.state.step.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }

  setStep(step: number): void {
    this.state.step.set(step);
  }
}
