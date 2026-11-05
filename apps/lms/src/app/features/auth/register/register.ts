import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Button,
  Field,
  Icon,
  IconButton,
  Input,
  Mai,
  Select,
} from '@lms/ui';
import { RegisterStore } from './data-access/register.store';
import {
  EMPTY_REGISTER_FORM,
  RegisterFormSchema,
  type RegisterFormValue,
} from './register.form';

/** The registration page: a visitor sends a request that an admin approves. */
@Component({
  selector: 'app-register',
  imports: [
    Alert,
    Button,
    Field,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    Mai,
    RouterLink,
    Select,
  ],
  providers: [RegisterStore],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  protected readonly store = inject(RegisterStore);
  protected readonly showPassword = signal(false);

  private readonly model = signal<RegisterFormValue>({
    ...EMPTY_REGISTER_FORM,
  });
  protected readonly registerForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, RegisterFormSchema);
    },
    {
      submission: {
        action: async () => {
          const value = this.model();
          this.store.send({
            staffCode: value.staffCode.trim(),
            fullName: value.fullName.trim(),
            email: value.email.trim(),
            orgId: Number(value.orgId),
            password: value.password,
          });
        },
      },
    },
  );

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }
}
