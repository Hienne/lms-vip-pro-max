import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, input, model } from '@angular/core';
import { COMMUNITY_LIMITS, type TagView } from '@lms/contracts';

/**
 * Picks up to {@link COMMUNITY_LIMITS}.tags tags for a question, article or lesson. A multi-select
 * list box of chip-looking options (arrow keys move, Space toggles); `value` holds the tag ids and
 * a pick past the limit is ignored while the counter says why.
 */
@Component({
  selector: 'app-tag-picker',
  imports: [Listbox, Option],
  templateUrl: './tag-picker.html',
  styleUrl: './tag-picker.scss',
})
export class TagPicker {
  readonly tags = input.required<readonly TagView[]>();
  readonly label = input('Thẻ');
  readonly value = model<number[]>([]);

  protected readonly max = COMMUNITY_LIMITS.tags.max;
  protected readonly full = computed(() => this.value().length >= this.max);

  protected choose(ids: number[]): void {
    if (ids.length > this.max) return;
    this.value.set(ids);
  }
}
