import { booleanAttribute, Directive, input } from '@angular/core';

/**
 * The look of a native `<table>`; semantics stay native (`<caption>`, `<th scope>`,
 * `aria-sort` on sortable headers). Wrap it in `<div uiTableWrap>` so a wide table scrolls
 * instead of overflowing the page. Right-align numeric columns with `text-right`.
 *
 * `responsive` turns each row into a card below 720px: put `data-label="Cột"` on every `<td>`
 * and the label is shown before its value.
 */
@Directive({
  selector: 'table[uiTable]',
  host: { class: 'table', '[class.table--responsive]': 'responsive()' },
})
export class Table {
  readonly responsive = input(false, { transform: booleanAttribute });
}
