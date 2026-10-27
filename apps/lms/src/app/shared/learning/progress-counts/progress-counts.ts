import { Component, computed, input } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';

export type ProgressCountsValue = LearningProgressOverview['counts'];

/**
 * The learner's course counts as a row of label over number, no card per number (visual-design.md).
 * Every number is the server's; the overdue one is danger text only while it is above zero.
 */
@Component({
  selector: 'app-progress-counts',
  templateUrl: './progress-counts.html',
  styleUrl: './progress-counts.scss',
})
export class ProgressCounts {
  readonly counts = input.required<ProgressCountsValue>();

  protected readonly items = computed(() => {
    const counts = this.counts();
    return [
      { label: 'Tổng số khóa', value: counts.total, danger: false },
      { label: 'Hoàn thành', value: counts.completed, danger: false },
      { label: 'Đang học', value: counts.inProgress, danger: false },
      { label: 'Chưa bắt đầu', value: counts.notStarted, danger: false },
      {
        label: 'Đang quá hạn',
        value: counts.overdue,
        danger: counts.overdue > 0,
      },
    ];
  });
}
