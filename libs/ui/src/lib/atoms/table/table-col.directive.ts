import { Directive, input } from '@angular/core';

/**
 * A fixed-width column of a `<colgroup>`: `<col uiTableCol width="8rem" />`. The width is a CSS
 * length or percentage, applied through a CSS variable. Set `fixed` on the `uiTable` so the
 * widths are honoured and the other columns share the rest. Hidden when a `responsive` table
 * turns into cards.
 */
@Directive({
  selector: 'col[uiTableCol]',
  host: { class: 'table__col', '[style.--table-col-width]': 'width()' },
})
export class TableCol {
  readonly width = input.required<string>();
}
