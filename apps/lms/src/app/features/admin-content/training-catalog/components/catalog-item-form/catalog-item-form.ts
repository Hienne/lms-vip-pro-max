import { Component, input, linkedSignal, output } from '@angular/core';
import {
  disabled,
  form,
  FormField,
  FormRoot,
  required,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { TrainingField } from '@lms/contracts';
import { Field, Input, Select, Textarea } from '@lms/ui';
import { CATALOG_STATUS_LABEL } from '../../../../../shared/status/catalog-status';
import type {
  CatalogItem,
  CatalogKind,
  SaveCatalogItem,
} from '../../data-access/training-catalog.store';
import {
  CatalogItemFormSchema,
  toCatalogItemFormValue,
} from './catalog-item-form.schema';

/**
 * The add/edit form of a field, module or program. A module belongs to a field, chosen when it is
 * added (an update cannot move it); a program may name one. Modules carry no description on the
 * backend. The submit button lives in the drawer footer and points here by `form` id.
 */
@Component({
  selector: 'app-catalog-item-form',
  imports: [Field, FormField, FormRoot, Input, Select, Textarea],
  templateUrl: './catalog-item-form.html',
})
export class CatalogItemForm {
  readonly kind = input.required<CatalogKind>();
  /** The row being edited; `null` adds a new one. */
  readonly item = input.required<CatalogItem | null>();
  readonly fields = input.required<readonly TrainingField[]>();
  /** The field a new module goes under: the one the modules tab shows. */
  readonly defaultFieldId = input<number>();
  readonly submitted = output<SaveCatalogItem>();

  protected readonly statuses = Object.entries(CATALOG_STATUS_LABEL);

  private readonly model = linkedSignal(() =>
    toCatalogItemFormValue(this.item(), this.defaultFieldId()),
  );
  protected readonly itemForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, CatalogItemFormSchema);
      required(path.fieldId, {
        message: 'Chọn lĩnh vực.',
        when: () => this.kind() === 'modules',
      });
      disabled(path.fieldId, () => !!this.item() && this.kind() === 'modules');
    },
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const kind = this.kind();
    const item = this.item();
    const value = this.model();
    const fieldId = Number(value.fieldId) || undefined;
    const description = value.description.trim();
    this.submitted.emit({
      kind,
      item,
      command: {
        code: value.code.trim(),
        name: value.name.trim(),
        status: value.status,
        ...(kind !== 'fields' && fieldId ? { fieldId } : {}),
        ...(kind !== 'modules' && description ? { description } : {}),
        ...(item?.sortNo != null ? { sortNo: item.sortNo } : {}),
      },
    });
  }
}
