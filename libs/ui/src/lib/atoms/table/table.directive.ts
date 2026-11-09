import { booleanAttribute, Directive, input } from '@angular/core';

/**
 * The look of a native `<table>`; semantics stay native (`<caption>`, `<th scope>`,
 * `aria-sort` on sortable headers). Wrap it in `<div uiTableWrap>` so a wide table scrolls
 * instead of overflowing the page. Keep rows to one line with `uiTableCell nowrap` and right-align figures with `uiTableCell numeric`.
 *
 * `responsive` turns each row into a card below 720px: put `data-label="Cột"` on every `<td>`
 * and the label is shown before its value.
 */
@Directive({
  selector: 'table[uiTable]',
  host: {
    class: 'table',
    '[class.table--responsive]': 'responsive()',
    '[class.table--fixed]': 'fixed()',
  },
})
export class Table {
  readonly responsive = input(false, { transform: booleanAttribute });
  /** Fixed column layout: `<col uiTableCol width>` widths are honoured and long content cannot widen a column. */
  readonly fixed = input(false, { transform: booleanAttribute });
}
