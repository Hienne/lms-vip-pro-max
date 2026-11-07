import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  readonly,
  validateStandardSchema,
} from '@angular/forms/signals';
import { isEmptyPatch } from '@lms/contracts';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Icon,
  Input,
  PageHeader,
  Progress,
} from '@lms/ui';
import { PasswordChangeStore } from '../../../shared/account/password-change.store';
import { PasswordForm } from '../../../shared/account/password-form/password-form';
import { AccountStatus } from '../../../shared/status/account-status';
import { RoleBadge } from '../../../shared/status/role-badge';
import { ProfileStore } from './data-access/profile.store';
import {
  ProfileFormSchema,
  toProfileFormValue,
  toUpdateMeCommand,
} from './profile.form';

/**
 * The profile page (the mockup's `profile`): the personal fields the user may edit, the
 * organisation, grants and screens the backend manages (read-only), and the password change.
 */
@Component({
  selector: 'app-profile',
  imports: [
    AccountStatus,
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    CardBody,
    CardHeader,
    Field,
    FormField,
    FormRoot,
    Icon,
    Input,
    PageHeader,
    PasswordForm,
    Progress,
    RoleBadge,
  ],
  providers: [ProfileStore, PasswordChangeStore],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected readonly store = inject(ProfileStore);
  protected readonly password = inject(PasswordChangeStore);

  private readonly model = linkedSignal(() =>
    toProfileFormValue(this.store.user$()),
  );
  protected readonly profileForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, ProfileFormSchema);
      readonly(path, { when: () => this.store.readOnly$() });
    },
    {
      submission: {
        action: async () => {
          const user = this.store.user$();
          if (user && !this.unchanged()) this.store.save(this.patch());
        },
      },
    },
  );

  /** What a save would send; empty while the form still equals the signed-in user. */
  private readonly patch = computed(() => {
    const user = this.store.user$();
    return user ? toUpdateMeCommand(user, this.model()) : {};
  });
  protected readonly unchanged = computed(() => isEmptyPatch(this.patch()));
}
