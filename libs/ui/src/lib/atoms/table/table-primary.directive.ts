import { Directive } from '@angular/core';

/** The main line of a two-line table cell (the mockup's `.table__primary`). */
@Directive({ selector: '[uiTablePrimary]', host: { class: 'table__primary' } })
export class TablePrimary {}
