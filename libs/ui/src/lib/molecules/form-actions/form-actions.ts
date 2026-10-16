import { Component, input, output } from '@angular/core';
import { Button } from '../../atoms/button/button.directive';

/**
 * The buttons of a form, usually in a drawer footer: cancel, then a submit bound to the form by
 * its id (the form need not be inside). Project extra actions, such as a reset, to put them first.
 * It carries the labels it is given and knows nothing about stores or errors.
 *
 * `<ui-form-actions formId="role-form" submitLabel="Lưu" cancelLabel="Hủy" [saving]="saving()" (cancel)="close()" />`
 */
@Component({
  selector: 'ui-form-actions',
  imports: [Button],
  host: { class: 'form-actions' },
  template: `
    <ng-content />
    <button uiButton variant="ghost" (click)="cancel.emit()">
      {{ cancelLabel() }}
    </button>
    <button
      uiButton
      variant="primary"
      type="submit"
      [attr.form]="formId()"
      [disabled]="saving()"
    >
      {{ submitLabel() }}
    </button>
  `,
})
export class FormActions {
  /** The `id` of the `<form>` the submit button belongs to. */
  readonly formId = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  /** Disables the submit button while a save is in flight. */
  readonly saving = input(false);
  // `cancel` is a dialog event, but this is not a dialog: the name is the form's own intent.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly cancel = output<void>();
}
