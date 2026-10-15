import { Directive, inject, input, TemplateRef } from '@angular/core';

export interface DataTableCellContext<T> {
  readonly $implicit: T;
}

/**
 * The template of one column's cell: `<ng-template uiDataTableCell="name" [of]="rows" let-row>`.
 * `of` only types `let-row`; the table passes each row in. A column without a template shows
 * `row[key]`.
 */
@Directive({ selector: 'ng-template[uiDataTableCell]' })
export class DataTableCell<T = unknown> {
  readonly key = input.required<string>({ alias: 'uiDataTableCell' });
  readonly of = input<readonly T[]>();
  readonly template = inject<TemplateRef<DataTableCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: DataTableCell<T>,
    _ctx: unknown,
  ): _ctx is DataTableCellContext<T> {
    return true;
  }
}
