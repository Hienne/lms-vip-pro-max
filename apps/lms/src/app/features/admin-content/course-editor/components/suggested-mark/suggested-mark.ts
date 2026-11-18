import { Component, computed, inject } from '@angular/core';
import { Badge, Icon } from '@lms/ui';
import { DraftingFillStore } from '../../data-access/drafting-fill.store';

/**
 * "AI đề xuất" beside a field, row or question the assistant wrote and the author has not changed
 * since: the one marker of a drafting session's proposals on the editor page. A Trợ lý ngoài's
 * proposals say "Đề xuất từ Trợ lý ngoài" instead.
 */
@Component({
  selector: 'app-suggested-mark',
  imports: [Badge, Icon],
  template: `<span uiBadge
    ><ui-icon name="sparkles" size="sm" />{{ label() }}</span
  >`,
  styleUrl: './suggested-mark.scss',
})
export class SuggestedMark {
  private readonly fill = inject(DraftingFillStore, { optional: true });

  protected readonly label = computed(() =>
    this.fill?.external$() ? 'Đề xuất từ Trợ lý ngoài' : 'AI đề xuất',
  );
}
