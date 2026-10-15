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
import type { MenuKey, Role, SaveRoleCommand } from '@lms/contracts';
import { Checkbox, Field, Input, Textarea } from '@lms/ui';
import { allSections } from '../../../../../core/menu/menu-catalog';
import { RoleFormSchema, toRoleFormValue } from './role-form.schema';

/**
 * The add/edit form of a role: a name, a description and the menus it grants, picked from the
 * sidebar entries by section. The submit button lives in the drawer footer and points here by
 * `form` id. Holding a menu means everything on its screens, so there is nothing finer to pick.
 */
@Component({
  selector: 'app-role-form',
  imports: [Checkbox, Field, FormField, Input, Textarea],
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
})
export class RoleForm {
  /** The role being edited; `null` adds a new one. */
  readonly role = input.required<Role | null>();
  /** Per-field messages of the server's 422 (`name` when it is taken). */
  readonly serverErrors = input<Readonly<Record<string, string>>>({});
  readonly submitted = output<SaveRoleCommand>();

  protected readonly sections = allSections();

  private readonly model = linkedSignal(() => toRoleFormValue(this.role()));
  protected readonly roleForm = form(this.model, (path) => {
    validateStandardSchema(path, RoleFormSchema);
  });

  protected readonly chosen = computed(() => new Set(this.model().menus));

  protected readonly nameErrors = computed(() => {
    const own = this.roleForm.name().touched()
      ? this.roleForm
          .name()
          .errors()
          .map((error) => error.message ?? '')
          .filter(Boolean)
      : [];
    const server = this.serverErrors()['name'];
    return server ? [...own, server] : own;
  });

  protected toggle(key: MenuKey, on: boolean): void {
    this.model.update((value) => ({
      ...value,
      menus: on
        ? [...value.menus.filter((m) => m !== key), key]
        : value.menus.filter((m) => m !== key),
    }));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.roleForm, async () => {
      const id = this.role()?.id;
      const value = this.model();
      this.submitted.emit({
        ...(id ? { id } : {}),
        name: value.name.trim(),
        description: value.description.trim(),
        menus: value.menus,
      });
    });
  }
}
