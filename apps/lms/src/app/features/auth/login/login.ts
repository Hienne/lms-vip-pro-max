import { Component, computed, inject, signal } from '@angular/core';
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
  ErrorSummary,
  type ErrorSummaryItem,
  Field,
  Icon,
  type IconName,
  IconButton,
  Input,
  LinkButton,
  Mai,
} from '@lms/ui';
import { roleLabel } from '../../../shared/status/role-badge';
import { LoginStore } from './data-access/login.store';

const EMAIL_ID = 'login-email';
const PASSWORD_ID = 'login-password';
const SUMMARY_HEADING = 'Không đăng nhập được';

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

interface Summary {
  readonly heading: string;
  readonly items: readonly ErrorSummaryItem[];
}

/** The sign-in page (the mockup's `login`), on the bare layout. */
@Component({
  selector: 'app-login',
  imports: [
    Alert,
    Avatar,
    Button,
    ErrorSummary,
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
  protected readonly emailId = EMAIL_ID;
  protected readonly passwordId = PASSWORD_ID;
  protected readonly showPassword = signal(false);

  private readonly model = signal<LoginCommand>({ email: '', password: '' });
  protected readonly loginForm = form(this.model, (path) => {
    validateStandardSchema(path, LoginCommandSchema);
  });

  /** Messages for the two fields, from what the server answered to the form. */
  protected readonly fieldErrors = computed(() => {
    const error = this.store.error$();
    if (!error || this.store.source$() !== 'form') return NO_FIELD_ERRORS;
    if (error.kind === 'invalid') {
      const { email, password } = error.details ?? {};
      return {
        email: email ? [email] : [],
        password: password ? [password] : [],
      };
    }
    if (error.kind === 'unauthorized' || error.kind === 'locked') {
      return { email: [], password: [error.message] };
    }
    return NO_FIELD_ERRORS;
  });

  protected readonly summary = computed<Summary | null>(() => {
    const error = this.store.error$();
    if (!error) return null;
    const fields = this.fieldErrors();
    if (error.kind === 'invalid' && this.store.source$() === 'form') {
      return {
        heading: error.message,
        items: [
          ...fields.email.map((message) => ({ controlId: EMAIL_ID, message })),
          ...fields.password.map((message) => ({
            controlId: PASSWORD_ID,
            message,
          })),
        ],
      };
    }
    return {
      heading: SUMMARY_HEADING,
      items: [
        {
          controlId: fields.password.length ? PASSWORD_ID : EMAIL_ID,
          message: error.message,
        },
      ],
    };
  });

  protected accountRole(account: {
    role: Parameters<typeof roleLabel>[0];
    adminScope: string | null;
  }): string {
    return roleLabel(account.role) + (account.adminScope ? ' đơn vị' : '');
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

const NO_FIELD_ERRORS: {
  readonly email: readonly string[];
  readonly password: readonly string[];
} = { email: [], password: [] };
