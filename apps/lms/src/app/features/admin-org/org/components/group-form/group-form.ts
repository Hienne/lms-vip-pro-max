import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { OrgGroup, SaveGroupCommand } from '@lms/contracts';
import { Field, Input } from '@lms/ui';
import { GroupFormSchema } from './group-form.schema';

/** The add/rename form of a group; the unit comes from the store, which knows the picked one. */
@Component({
  selector: 'app-group-form',
  imports: [Field, FormField, Input],
  templateUrl: './group-form.html',
})
export class GroupForm {
  /** The group being renamed; `null` adds a new one. */
  readonly group = input.required<OrgGroup | null>();
  readonly serverErrors = input<Readonly<Record<string, string>>>({});
  readonly submitted = output<Omit<SaveGroupCommand, 'unitId'>>();

  private readonly model = linkedSignal(() => ({
    name: this.group()?.name ?? '',
  }));
  protected readonly groupForm = form(this.model, (path) => {
    validateStandardSchema(path, GroupFormSchema);
  });

  protected readonly nameErrors = computed(() => {
    const own = this.groupForm.name().touched()
      ? this.groupForm
          .name()
          .errors()
          .map((error) => error.message ?? '')
          .filter(Boolean)
      : [];
    const server = this.serverErrors()['name'];
    return server ? [...own, server] : own;
  });

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.groupForm, async () => {
      const group = this.group();
      this.submitted.emit({
        ...(group ? { id: group.id, kind: group.kind } : {}),
        name: this.model().name.trim(),
      });
    });
  }
}
