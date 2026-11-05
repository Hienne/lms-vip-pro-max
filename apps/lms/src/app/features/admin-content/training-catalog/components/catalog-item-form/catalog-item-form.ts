import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { CatalogTreeField, CatalogTreeProgram } from '@lms/contracts';
import { Field, Input, Textarea } from '@lms/ui';
import type { SaveCatalogItem } from '../../data-access/training-catalog.store';
import {
  CatalogItemFormSchema,
  toCatalogItemFormValue,
} from './catalog-item-form.schema';

/**
 * The add/edit form of a field or a program (a program stays under the field it was added to). A
 * new row starts as a draft and an edited one keeps its status: publishing, pausing and archiving
 * are buttons on the detail panel. The submit button lives in the drawer footer and points here
 * by `form` id.
 */
@Component({
  selector: 'app-catalog-item-form',
  imports: [Field, FormField, FormRoot, Input, Textarea],
  templateUrl: './catalog-item-form.html',
})
export class CatalogItemForm {
  readonly kind = input.required<'field' | 'program'>();
  /** The row being edited; `null` adds a new one. */
  readonly item = input.required<
    CatalogTreeField | CatalogTreeProgram | null
  >();
  readonly submitted = output<SaveCatalogItem>();

  private readonly model = linkedSignal(() =>
    toCatalogItemFormValue(this.item()),
  );
  protected readonly itemForm = form(
    this.model,
    (path) => validateStandardSchema(path, CatalogItemFormSchema),
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const value = this.model();
    const description = value.description.trim();
    this.submitted.emit({
      code: value.code.trim(),
      name: value.name.trim(),
      status: this.item()?.status ?? 'draft',
      ...(description ? { description } : {}),
    });
  }
}
