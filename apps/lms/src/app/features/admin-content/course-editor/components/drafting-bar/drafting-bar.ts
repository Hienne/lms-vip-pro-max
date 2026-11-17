import { Component, inject } from '@angular/core';
import { Alert, AlertAction, Button } from '@lms/ui';
import { CourseDraftingStore } from '../../../../../core/course-drafting/course-drafting.store';
import { DraftingFillStore } from '../../data-access/drafting-fill.store';

/**
 * The bar at the top of a step the assistant drafts: "Trợ lý đang soạn…" with "Dừng" while the
 * server works on the step or its fields are being written. It renders nothing otherwise.
 */
@Component({
  selector: 'app-drafting-bar',
  imports: [Alert, AlertAction, Button],
  templateUrl: './drafting-bar.html',
  styleUrl: './drafting-bar.scss',
})
export class DraftingBar {
  protected readonly fill = inject(DraftingFillStore);
  protected readonly drafting = inject(CourseDraftingStore);
}
