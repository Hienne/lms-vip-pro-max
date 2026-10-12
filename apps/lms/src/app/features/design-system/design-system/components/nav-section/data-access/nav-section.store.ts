import { Injectable, signal } from '@angular/core';

export type Period = 'week' | 'month' | 'quarter';

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    expanded: signal<readonly string[]>(['domain-ops', 'program-foundation']),
    selectedNode: signal<string | undefined>(undefined),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly expanded$ = this.state.expanded.asReadonly();
  readonly selectedNode$ = this.state.selectedNode.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
  }

  setExpanded(ids: readonly string[]): void {
    this.state.expanded.set(ids);
  }

  setSelectedNode(id: string | undefined): void {
    this.state.selectedNode.set(id);
  }
}
