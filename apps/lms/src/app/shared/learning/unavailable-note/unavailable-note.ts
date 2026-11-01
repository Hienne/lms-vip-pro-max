import { Component, computed, input } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';

/**
 * One muted line while the backend has no hours or scores to show, so the page says so once
 * instead of showing zeros or placeholders. Competency has its own endpoint and card, so the
 * summary's `competency` availability is not part of it.
 */
@Component({
  selector: 'app-unavailable-note',
  template: `
    @if (unavailable()) {
      <p class="unavailable-note">
        Giờ học và điểm kiểm tra sẽ hiển thị khi hệ thống có dữ liệu.
      </p>
    }
  `,
  styleUrl: './unavailable-note.scss',
})
export class UnavailableNote {
  readonly summary = input.required<LearningProgressOverview>();

  protected readonly unavailable = computed(() => {
    const { activity, assessment } = this.summary();
    return [activity, assessment].some(
      (metric) => metric.availability === 'unavailable',
    );
  });
}
