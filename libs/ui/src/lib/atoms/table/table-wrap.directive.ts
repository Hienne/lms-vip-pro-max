import { Directive } from '@angular/core';

/** Scroll container for a wide table (the mockup's `.table-wrap`). */
@Directive({ selector: 'div[uiTableWrap]', host: { class: 'table-wrap' } })
export class TableWrap {}
