import { Component, input, output, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  type ChangePasswordV1Command,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
} from '@lms/contracts';
import { Button, Field, Input } from '@lms/ui';
import {
  EMPTY_PASSWORD_FORM,
  PasswordFormSchema,
  type PasswordFormValue,
} from './password-form.schema';

/**
 * The change-password form, shared by the profile page and the forced change after a temporary
 * password. The page recreates it after a successful change, which is how the fields come back
 * empty and untouched (the mockup calls `form.reset()`).
 */
@Component({
  selector: 'app-password-form',
  imports: [Button, Field, FormField, FormRoot, Input],
  templateUrl: './password-form.html',
  styleUrl: './password-form.scss',
})
export class PasswordForm {
  readonly busy = input(false);
  readonly submitted = output<ChangePasswordV1Command>();

  protected readonly rules = `Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự, tối đa ${PASSWORD_MAX_BYTES} byte và khác mật khẩu hiện tại.`;

  private readonly model = signal<PasswordFormValue>({
    ...EMPTY_PASSWORD_FORM,
  });
  protected readonly passwordForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, PasswordFormSchema);
    },
    {
      submission: {
        action: async () => {
          const { currentPassword, newPassword } = this.model();
          this.submitted.emit({ currentPassword, newPassword });
        },
      },
    },
  );
}
