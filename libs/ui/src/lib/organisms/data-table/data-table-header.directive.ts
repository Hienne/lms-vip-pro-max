import { Directive, inject, input, TemplateRef } from '@angular/core';

/**
 * The template of one column's header, in place of its label text: a select-all checkbox, say.
 * `<ng-template uiDataTableHeader="selected">`. The header is then not a sort button, and the
 * column's `label` stays the cell's `data-label` and its accessible name.
 */
@Directive({ selector: 'ng-template[uiDataTableHeader]' })
export class DataTableHeader {
  readonly key = input.required<string>({ alias: 'uiDataTableHeader' });
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
