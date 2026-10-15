import { Component, computed, input, output, signal } from '@angular/core';
import {
  type FieldTree,
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import type { ChangePasswordCommand } from '@lms/contracts';
import { Button, Field, Input } from '@lms/ui';
import { EMPTY_PASSWORD_FORM, PasswordFormSchema } from '../../profile.form';

/**
 * The change-password form of the profile page. The page recreates it after a successful change,
 * which is how the fields come back empty and untouched (the mockup calls `form.reset()`).
 */
@Component({
  selector: 'app-password-form',
  imports: [Button, Field, FormField, Input],
  templateUrl: './password-form.html',
  styleUrl: './password-form.scss',
})
export class PasswordForm {
  /** Per-field messages of the server's 422 (`cur`, `next`, `confirm`). */
  readonly serverErrors = input<Readonly<Record<string, string>>>({});
  readonly busy = input(false);
  readonly submitted = output<ChangePasswordCommand>();

  private readonly model = signal<ChangePasswordCommand>({
    ...EMPTY_PASSWORD_FORM,
  });
  protected readonly passwordForm = form(this.model, (path) => {
    validateStandardSchema(path, PasswordFormSchema);
  });

  protected readonly curErrors = computed(() =>
    this.messages(this.passwordForm.cur, 'cur'),
  );
  protected readonly nextErrors = computed(() =>
    this.messages(this.passwordForm.next, 'next'),
  );
  protected readonly confirmErrors = computed(() =>
    this.messages(this.passwordForm.confirm, 'confirm'),
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

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.passwordForm, async () => {
      this.submitted.emit({ ...this.model() });
    });
  }
}
