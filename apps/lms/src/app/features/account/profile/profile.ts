import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  Input,
  PageHeader,
} from '@lms/ui';
import { menuLabel } from '../../../core/menu/menu-catalog';
import { AccountStatus } from '../../../shared/status/account-status';
import { isUnitAdmin, RoleBadge } from '../../../shared/status/role-badge';
import { PasswordForm } from './components/password-form/password-form';
import { ProfileStore } from './data-access/profile.store';
import {
  ProfileFormSchema,
  toProfileFormValue,
  toUpdateProfileCommand,
} from './profile.form';

/** The profile page (the mockup's `profile`): personal fields, organisation facts and password. */
@Component({
  selector: 'app-profile',
  imports: [
    AccountStatus,
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Field,
    FmtDatePipe,
    FmtRelativePipe,
    FormField,
    Icon,
    Input,
    PageHeader,
    PasswordForm,
    RoleBadge,
  ],
  providers: [ProfileStore],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected readonly store = inject(ProfileStore);

  private readonly model = linkedSignal(() =>
    toProfileFormValue(this.store.user$()),
  );
  protected readonly profileForm = form(this.model, (path) => {
    validateStandardSchema(path, ProfileFormSchema);
  });

  protected readonly nameErrors = computed(() =>
    this.profileForm.name().touched()
      ? this.profileForm
          .name()
          .errors()
          .map((error) => error.message ?? '')
          .filter(Boolean)
      : [],
  );

  protected readonly scopedAdmin = computed(() => {
    const user = this.store.user$();
    return user ? isUnitAdmin(user) : false;
  });

  /** The menus the role grants, by their sidebar names (the mockup listed raw permission keys). */
  protected readonly menuLabels = computed(() =>
    (this.store.user$()?.menus ?? []).map(menuLabel),
  );

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.profileForm, async () => {
      this.store.save(toUpdateProfileCommand(this.model()));
    });
  }
}
