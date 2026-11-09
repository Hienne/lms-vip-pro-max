import { Component, computed, input, output } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';
import { FmtPctPipe, Stat, StatStrip } from '@lms/ui';

export type ProgressCountFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'not_started'
  | 'overdue';
export type ProgressCountsValue = LearningProgressOverview['counts'];

/**
 * The learner's course counts as one `ui-stat-strip` (visual-design.md): every number is the
 * server's, and the overdue one is danger text only while it is above zero. `averageScore`, when
 * given, ends the strip with the server's average quiz score (`null` is "—"). With `interactive`
 * each count is a toggle that asks the page to filter its course list (`filterSelected`).
 */
@Component({
  selector: 'app-progress-counts',
  imports: [FmtPctPipe, Stat, StatStrip],
  templateUrl: './progress-counts.html',
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
        hint: null,
        filter: 'all' as const,
      },
      {
        label: 'Hoàn thành',
        value: counts.completed,
        danger: false,
        hint: null,
        filter: 'completed' as const,
      },
      {
        label: 'Đang học',
        value: counts.inProgress,
        danger: false,
        hint: null,
        filter: 'in_progress' as const,
      },
      {
        label: 'Chưa bắt đầu',
        value: counts.notStarted,
        danger: false,
        hint: null,
        filter: 'not_started' as const,
      },
      {
        label: 'Đang quá hạn',
        value: counts.overdue,
        danger: counts.overdue > 0,
        hint: 'Khóa quá hạn có thể đang học hoặc chưa bắt đầu.',
        filter: 'overdue' as const,
      },
    ];
  });
}
