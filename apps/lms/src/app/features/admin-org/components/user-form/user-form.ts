import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  disabled,
  type FieldTree,
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import type {
  AdminMeta,
  Profile,
  SaveUserCommand,
  UserListItem,
} from '@lms/contracts';
import { Alert, Field, Input, Select } from '@lms/ui';
import {
  toSaveUserCommand,
  toUserFormValue,
  UserFormSchema,
  WHOLE_SYSTEM,
  type UserFormValue,
} from './user-form.schema';

/**
 * The add/edit form of a user (the mockup's `userForm` drawer body). It owns the form model and
 * the validation; the submit button lives in the drawer footer and points here by `form` id.
 * Role and scope are fixed while editing yourself, so nobody locks themselves out.
 */
@Component({
  selector: 'app-user-form',
  imports: [Alert, Field, FormField, Input, Select],
  templateUrl: './user-form.html',
})
export class UserForm {
  /** The user being edited; `null` adds a new one. */
  readonly user = input.required<UserListItem | null>();
  readonly meta = input.required<AdminMeta>();
  readonly me = input.required<Pick<Profile, 'id' | 'scopeUnitId'>>();
  /** Per-field messages of the server's 422 (`email` is the usual one). */
  readonly serverErrors = input<Readonly<Record<string, string>>>({});
  readonly submitted = output<SaveUserCommand>();

  /** The unit a new user starts in: the caller's own when limited to one, else the first allowed. */
  private readonly defaults = computed(() => {
    const scopeUnitId = this.me().scopeUnitId;
    const meta = this.meta();
    return {
      unitId: scopeUnitId ?? meta.units[0]?.id ?? '',
      roleId: meta.roles.find((role) => role.id === 'learner')?.id ?? '',
      scopeUnitId,
    };
  });

  protected readonly isSelf = computed(() => this.user()?.id === this.me().id);

  private readonly model = linkedSignal<UserFormValue>(() =>
    toUserFormValue(this.user(), this.defaults()),
  );
  protected readonly userForm = form(this.model, (path) => {
    validateStandardSchema(path, UserFormSchema);
    disabled(path.roleId, () => this.isSelf());
    disabled(path.scope, () => this.isSelf());
  });
  protected readonly groups = computed(() =>
    this.meta().groups.filter((group) => group.unitId === this.model().unitId),
  );
  /** A caller limited to one unit cannot grant the whole system, so that choice is absent. */
  protected readonly scopeOptions = computed(() => {
    const own = this.me().scopeUnitId;
    const units = this.meta().allUnits.filter(
      (unit) => own === null || unit.id === own,
    );
    return [
      ...(own === null
        ? [{ value: WHOLE_SYSTEM, label: 'Toàn hệ thống' }]
        : []),
      ...units.map((unit) => ({
        value: unit.id,
        label: `Chỉ đơn vị: ${unit.name}`,
      })),
    ];
  });

  protected readonly nameErrors = computed(() =>
    this.messages(this.userForm.name, 'name'),
  );
  protected readonly emailErrors = computed(() =>
    this.messages(this.userForm.email, 'email'),
  );
  protected readonly unitErrors = computed(() =>
    this.messages(this.userForm.unitId, 'unitId'),
  );
  protected readonly groupErrors = computed(() =>
    this.messages(this.userForm.groupId, 'groupId'),
  );
  protected readonly roleErrors = computed(() =>
    this.messages(this.userForm.roleId, 'roleId'),
  );

  private messages(field: FieldTree<string>, key: string): readonly string[] {
    const own = field().touched()
      ? field()
          .errors()
          .map((error) => error.message ?? '')
          .filter(Boolean)
      : [];
    const server = this.serverErrors()[key];
    return server ? [...own, server] : own;
  }

  /** A different unit has different groups, so the chosen one no longer applies. */
  protected onUnitChange(): void {
    this.model.update((value) => ({ ...value, groupId: '' }));
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.userForm, async () => {
      this.submitted.emit(toSaveUserCommand(this.user()?.id, this.model()));
    });
  }
}
