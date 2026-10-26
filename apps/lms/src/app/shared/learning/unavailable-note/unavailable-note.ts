import { Component, computed, input } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';

/**
 * One muted line while the backend has no hours, scores or competency to show, so the page says
 * so once instead of showing zeros or placeholders.
 */
@Component({
  selector: 'app-unavailable-note',
  template: `
    @if (unavailable()) {
      <p class="unavailable-note">
        Giờ học, điểm kiểm tra và năng lực sẽ hiển thị khi hệ thống có dữ liệu.
      </p>
    }
  `,
  styleUrl: './unavailable-note.scss',
})
export class UnavailableNote {
  readonly summary = input.required<LearningProgressOverview>();

  protected readonly unavailable = computed(() => {
    const { activity, assessment, competency } = this.summary();
    return [activity, assessment, competency].some(
      (metric) => metric.availability === 'unavailable',
    );
  });
}
