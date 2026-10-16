import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type LoginCommand, LoginCommandSchema } from '@lms/contracts';
import {
  Alert,
  Avatar,
  Button,
  Field,
  Icon,
  type IconName,
  IconButton,
  Input,
  LinkButton,
  Mai,
} from '@lms/ui';
import { roleText } from '../../../shared/status/role-badge';
import { LoginStore } from './data-access/login.store';

/** The alert's heading when the backend sent no title for the failure. */
const FAILURE_HEADING = 'Không đăng nhập được';

/** The locked demo user of the seed, for the "try a locked account" shortcut. */
const LOCKED_EMAIL = 'long.pd@demo.cb';
const LOCKED_PASSWORD = '123456';

const BRAND_POINTS: readonly { icon: IconName; text: string }[] = [
  {
    icon: 'book-open',
    text: 'Tài liệu PDF, video, quy trình và bài kiểm tra trên cùng nền tảng',
  },
  {
    icon: 'history',
    text: 'Tiếp tục học đúng trang, đúng mốc video trên mọi thiết bị',
  },
  { icon: 'target', text: 'Theo dõi năng lực theo từng nhóm kiến thức' },
];

/** The sign-in page (the mockup's `login`), on the bare layout. */
@Component({
  selector: 'app-login',
  imports: [
    Alert,
    Avatar,
    Button,
    Field,
    FormField,
    Icon,
    IconButton,
    Input,
    LinkButton,
    Mai,
    RouterLink,
  ],
  providers: [LoginStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  protected readonly store = inject(LoginStore);

  protected readonly brandPoints = BRAND_POINTS;
  protected readonly failureHeading = FAILURE_HEADING;
  protected readonly showPassword = signal(false);

  private readonly model = signal<LoginCommand>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    validateStandardSchema(path, LoginCommandSchema);
  });

  protected accountRole(account: Parameters<typeof roleText>[0]): string {
    return roleText(account);
  }

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.loginForm, async () => {
      this.store.signIn(this.model());
    });
  }

  protected tryLocked(): void {
    this.model.set({ email: LOCKED_EMAIL, password: LOCKED_PASSWORD });
    void submit(this.loginForm, async () => {
      this.store.signIn(this.model());
    });
  }
}
