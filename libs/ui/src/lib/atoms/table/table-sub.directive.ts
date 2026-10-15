import { Directive } from '@angular/core';

/** The muted line under the main one in a table cell (the mockup's `.table__sub`). */
@Directive({ selector: '[uiTableSub]', host: { class: 'table__sub' } })
export class TableSub {}
