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
    lessons: signal(LESSONS),
  };

  readonly period$ = this.state.period.asReadonly();
  readonly lessons$ = this.state.lessons.asReadonly();

  setPeriod(period: Period): void {
    this.state.period.set(period);
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
