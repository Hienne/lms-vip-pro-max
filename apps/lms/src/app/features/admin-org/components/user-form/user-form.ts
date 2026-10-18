import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import {
  form,
  FormField,
  hidden,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import { isEmptyPatch } from '@lms/contracts';
import { Alert, Button, Field, Icon, Input, Select } from '@lms/ui';
import { UserEditorStore } from '../../data-access/user-editor.store';
import { GrantPicker } from '../grant-picker/grant-picker';
import {
  toCreateUserCommand,
  toUpdateUserCommand,
  toUserFormValue,
  UserFormSchema,
  type ManagedUser,
  type UserFormValue,
} from './user-form.schema';

/**
 * The add/edit form of a user (the mockup's `userForm` drawer body). It owns the form model and
 * the validation; the submit button lives in the drawer footer and points here by `form` id. An
 * edit sends only the changed fields; an add also collects the user's first role grants.
 */
@Component({
  selector: 'app-user-form',
  imports: [Alert, Button, Field, FormField, GrantPicker, Icon, Input, Select],
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
})
export class UserForm {
  protected readonly store = inject(UserEditorStore);

  /** The user being edited; `null` adds a new one. */
  readonly user = input.required<ManagedUser | null>();

  protected readonly isEdit = computed(() => this.user() !== null);

  private readonly model = linkedSignal<UserFormValue>(() =>
    toUserFormValue(this.user(), this.store.me$()?.org?.id ?? null),
  );
  protected readonly userForm = form(this.model, (path) => {
    validateStandardSchema(path, UserFormSchema);
    hidden(path.userId, { when: () => this.isEdit() });
    hidden(path.username, { when: () => this.isEdit() });
    hidden(path.initialPassword, { when: () => this.isEdit() });
  });

  /** Moving a user revokes the grants scoped to the old org or team: say so before saving. */
  protected readonly moves = computed(() => {
    const user = this.user();
    if (!user) return false;
    const value = this.model();
    return (
      value.orgId !== (user.orgId == null ? '' : String(user.orgId)) ||
      value.teamId !== (user.teamId == null ? '' : String(user.teamId))
    );
  });

  /** A different org has different teams, so the chosen one no longer applies. */
  protected onOrgChange(): void {
    this.model.update((value) => ({ ...value, teamId: '' }));
    const orgId = this.model().orgId;
    this.store.pickFormOrg(orgId ? Number(orgId) : undefined);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.userForm, async () => {
      const user = this.user();
      if (!user) {
        this.store.create(
          toCreateUserCommand(
            this.model(),
            this.store.pendingGrants$().map((p) => p.request),
          ),
        );
        return;
      }
      const patch = toUpdateUserCommand(user, this.model());
      if (isEmptyPatch(patch)) this.store.cancelEdit();
      else this.store.update(user.userId, patch);
    });
  }
}
