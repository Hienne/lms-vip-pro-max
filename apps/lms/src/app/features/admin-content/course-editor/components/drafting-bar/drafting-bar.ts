import { Dialog } from '@angular/cdk/dialog';
import { Component, inject, input, output } from '@angular/core';
import type { DraftingStepNumber } from '@lms/contracts';
import { Alert, AlertAction, Button, confirm, Icon } from '@lms/ui';
import { firstValueFrom } from 'rxjs';
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
  private readonly dialog = inject(Dialog);

  /** Why the step cannot be confirmed yet; null when it can. */
  readonly problem = input<string | null>(null);
  /** "Đã chốt" for this step: the page sends its values. */
  readonly confirmed = output<DraftingStepNumber>();

  /** "Đề xuất lại": what the step holds on the page is replaced, so the author agrees first. */
  protected async proposeAgain(step: DraftingStepNumber): Promise<void> {
    const agreed = await firstValueFrom(
      confirm(this.dialog, {
        title: 'Đề xuất lại bước này?',
        message:
          'Trợ lý soạn lại bước này từ tài liệu. Các trường của bước, kể cả phần bạn đã sửa, sẽ được thay bằng đề xuất mới. Các bước khác giữ nguyên.',
        confirmLabel: 'Đề xuất lại',
        tone: 'danger',
      }),
    );
    if (agreed) this.fill.proposeAgain(step);
  }
}
