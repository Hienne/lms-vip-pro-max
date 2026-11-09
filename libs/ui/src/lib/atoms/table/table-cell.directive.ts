import { booleanAttribute, computed, Directive, input } from '@angular/core';

/**
 * Cell modifiers for a `<th>` or `<td>` of a `uiTable`. `nowrap` keeps the content on one line
 * (dates, statuses, codes, short figures) so rows stay one line tall; `numeric` right-aligns a
 * figure with tabular digits, on its header too, and implies `nowrap`.
 */
@Directive({
  selector: 'th[uiTableCell], td[uiTableCell]',
  host: { '[class]': 'modifiers()' },
})
export class TableCell {
  readonly nowrap = input(false, { transform: booleanAttribute });
  readonly numeric = input(false, { transform: booleanAttribute });

  protected readonly modifiers = computed(() =>
    [
      this.nowrap() || this.numeric() ? 'table__cell--nowrap' : '',
      this.numeric() ? 'table__cell--numeric' : '',
    ].filter(Boolean),
  );
}
