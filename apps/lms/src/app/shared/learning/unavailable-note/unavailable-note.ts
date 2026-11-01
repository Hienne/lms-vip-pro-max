import { Component, computed, input } from '@angular/core';
import type { LearningProgressOverview } from '@lms/contracts';

/**
 * One muted line while the backend has no hours to show, so the page says so once instead of
 * showing zeros or placeholders. Scores and competency have their own figures and cards, so the
 * summary's `assessment` and `competency` availability are not part of it.
 */
@Component({
  selector: 'app-unavailable-note',
  template: `
    @if (unavailable()) {
      <p class="unavailable-note">
        Giờ học sẽ hiển thị khi hệ thống có dữ liệu.
      </p>
    }
  `,
  styleUrl: './unavailable-note.scss',
})
export class UnavailableNote {
  readonly summary = input.required<LearningProgressOverview>();

  protected readonly unavailable = computed(() => {
    return this.summary().activity.availability === 'unavailable';
  });
}
