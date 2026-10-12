import { Injectable, signal } from '@angular/core';
import type { SortableMove } from '@lms/ui';

export type Period = 'week' | 'month' | 'quarter';

export interface DemoLesson {
  readonly id: string;
  readonly title: string;
  readonly meta: string;
}

/** Lesson rows of the mockup's course editor. */
const LESSONS: readonly DemoLesson[] = [
  {
    id: 'l1',
    title: 'Giới thiệu hệ thống Core Banking',
    meta: 'Video · 12 phút',
  },
  { id: 'l2', title: 'Kiến trúc và các phân hệ', meta: 'PDF · 18 phút' },
  {
    id: 'l3',
    title: 'Luồng giao dịch từ kênh đến sổ cái',
    meta: 'Quy trình · 25 phút',
  },
  { id: 'l4', title: 'Bài kiểm tra chương 1', meta: 'Bài kiểm tra · 15 phút' },
];

@Injectable()
export class NavSectionStore {
  private readonly state = {
    period: signal<Period>('month'),
    tab: signal('overview'),
    step: signal(1),
    expanded: signal<readonly string[]>(['domain-ops', 'program-foundation']),
    selectedNode: signal<string | undefined>(undefined),
    lessons: signal(LESSONS),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly tab$ = this.state.tab.asReadonly();
  readonly step$ = this.state.step.asReadonly();
  readonly expanded$ = this.state.expanded.asReadonly();
  readonly selectedNode$ = this.state.selectedNode.asReadonly();
  readonly lessons$ = this.state.lessons.asReadonly();

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

  moveLesson({ from, to }: SortableMove): void {
    this.state.lessons.update((lessons) => {
      const next = [...lessons];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
}
