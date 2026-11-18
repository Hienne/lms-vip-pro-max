import { Component, inject, input, output } from '@angular/core';
import type { DraftingStepNumber } from '@lms/contracts';
import { Alert, AlertAction, Button, Icon } from '@lms/ui';
import { CourseDraftingStore } from '../../../../../core/course-drafting/course-drafting.store';
import { DraftingFillStore } from '../../data-access/drafting-fill.store';

/**
 * The bar at the top of a step the assistant drafts: "Trợ lý đang soạn…" with "Dừng" while the
 * server works on the step or its fields are being written, then "Đã chốt", which confirms the
 * step with the page's values, and "Đề xuất lại", which asks before the step's fields are
 * replaced. A step the assistant could not propose shows why, with "Thử lại" and "Tự điền".
 * "Đã chốt" stays disabled, saying why, while the step is invalid.
 */
@Component({
  selector: 'app-drafting-bar',
  imports: [Alert, AlertAction, Button, Icon],
  templateUrl: './drafting-bar.html',
  styleUrl: './drafting-bar.scss',
})
export class DraftingBar {
  protected readonly fill = inject(DraftingFillStore);
  protected readonly drafting = inject(CourseDraftingStore);

  /** Why the step cannot be confirmed yet; null when it can. */
  readonly problem = input<string | null>(null);
  /** The code the server proposed after a taken one, while the code field holds another. */
  readonly suggestedCode = input<string | null>(null);
  /** "Đã chốt" for this step: the page sends its values. */
  readonly confirmed = output<DraftingStepNumber>();
}
