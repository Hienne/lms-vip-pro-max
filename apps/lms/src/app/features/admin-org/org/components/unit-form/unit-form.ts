import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { OrgUnit, SaveUnitCommand } from '@lms/contracts';
import { Field, Input } from '@lms/ui';
import { UnitFormSchema } from './unit-form.schema';

/**
 * The add/edit form of a unit (the mockup's `simpleForm` for units). It owns the form model and
 * the validation; the submit button lives in the drawer footer and points here by `form` id.
 */
@Component({
  selector: 'app-unit-form',
  imports: [Field, FormField, Input],
  templateUrl: './unit-form.html',
})
export class UnitForm {
  /** The unit being edited; `null` adds a new one. */
  readonly unit = input.required<OrgUnit | null>();
  readonly submitted = output<SaveUnitCommand>();

  private readonly model = linkedSignal(() => ({
    code: this.unit()?.code ?? '',
    name: this.unit()?.name ?? '',
  }));
  protected readonly unitForm = form(this.model, (path) => {
    validateStandardSchema(path, UnitFormSchema);
  });

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.unitForm, async () => {
      const id = this.unit()?.id;
      const { code, name } = this.model();
      this.submitted.emit({
        ...(id ? { id } : {}),
        code: code.trim(),
        name: name.trim(),
      });
    });
  }
}
