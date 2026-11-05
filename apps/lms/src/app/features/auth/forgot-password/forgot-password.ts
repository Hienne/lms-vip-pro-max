import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Alert, Button, Field, Input, Mai } from '@lms/ui';
import { ForgotPasswordStore } from './data-access/forgot-password.store';
import {
  EMPTY_FORGOT_PASSWORD_FORM,
  ForgotPasswordFormSchema,
  type ForgotPasswordFormValue,
} from './forgot-password.form';

/** The forgot-password page: a visitor asks an admin for a temporary password. */
@Component({
  selector: 'app-forgot-password',
  imports: [Alert, Button, Field, FormField, FormRoot, Input, Mai, RouterLink],
  providers: [ForgotPasswordStore],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  protected readonly store = inject(ForgotPasswordStore);

  private readonly model = signal<ForgotPasswordFormValue>({
    ...EMPTY_FORGOT_PASSWORD_FORM,
  });
  protected readonly requestForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, ForgotPasswordFormSchema);
    },
    {
      submission: {
        action: async () => {
          this.store.send({ staffCode: this.model().staffCode.trim() });
        },
      },
    },
  );
}
