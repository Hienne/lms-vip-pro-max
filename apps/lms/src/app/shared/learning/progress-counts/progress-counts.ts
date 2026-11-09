import { Component, computed, input, output } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';
import { FmtPctPipe } from '@lms/ui';

export type ProgressCountFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'not_started'
  | 'overdue';
export type ProgressCountsValue = LearningProgressOverview['counts'];

/**
 * The learner's course counts as a row of label over number, no card per number (visual-design.md).
 * Every number is the server's; the overdue one is danger text only while it is above zero.
 * `averageScore`, when given, ends the row with the server's average quiz score (`null` is "—").
 */
@Component({
  selector: 'app-progress-counts',
  imports: [FmtPctPipe],
  templateUrl: './progress-counts.html',
  styleUrl: './progress-counts.scss',
})
export class ProgressCounts {
  readonly counts = input.required<ProgressCountsValue>();
  readonly averageScore = input<number | null>();
  readonly interactive = input(false);
  readonly selectedFilter = input<ProgressCountFilter | null>(null);
  readonly filterSelected = output<ProgressCountFilter>();

  protected readonly items = computed(() => {
    const counts = this.counts();
    return [
      {
        label: 'Tổng số khóa',
        value: counts.total,
        danger: false,
        filter: 'all' as const,
      },
      {
        label: 'Hoàn thành',
        value: counts.completed,
        danger: false,
        filter: 'completed' as const,
      },
      {
        label: 'Đang học',
        value: counts.inProgress,
        danger: false,
        filter: 'in_progress' as const,
      },
      {
        label: 'Chưa bắt đầu',
        value: counts.notStarted,
        danger: false,
        filter: 'not_started' as const,
      },
      {
        label: 'Đang quá hạn',
        value: counts.overdue,
        danger: counts.overdue > 0,
        filter: 'overdue' as const,
      },
    ];
  });
}
