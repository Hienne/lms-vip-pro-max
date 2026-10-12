import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    tab: signal('overview'),
    step: signal(1),
    expanded: signal<readonly string[]>(['domain-ops', 'program-foundation']),
    selectedNode: signal<string | undefined>(undefined),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly tab$ = this.state.tab.asReadonly();
  readonly step$ = this.state.step.asReadonly();
  readonly expanded$ = this.state.expanded.asReadonly();
  readonly selectedNode$ = this.state.selectedNode.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }

  setTab(tab: string): void {
    this.state.tab.set(tab);
  }

  setStep(step: number): void {
    this.state.step.set(step);
  }

  setExpanded(ids: readonly string[]): void {
    this.state.expanded.set(ids);
  }

  setSelectedNode(id: string | undefined): void {
    this.state.selectedNode.set(id);
  }
}
