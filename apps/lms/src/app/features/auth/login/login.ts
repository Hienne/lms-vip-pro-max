import { Component, computed, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  submit,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type LoginV1Command, LoginV1CommandSchema } from '@lms/contracts';
import {
  Alert,
  Button,
  ErrorSummary,
  type ErrorSummaryItem,
  Field,
  Icon,
  type IconName,
  IconButton,
  Input,
  Mai,
} from '@lms/ui';
import { LoginStore } from './data-access/login.store';

const USERNAME_ID = 'login-username';
const PASSWORD_ID = 'login-password';
const SUMMARY_HEADING = 'Không đăng nhập được';

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
    Button,
    ErrorSummary,
    Field,
    FormField,
    Icon,
    IconButton,
    Input,
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
  protected readonly usernameId = USERNAME_ID;
  protected readonly passwordId = PASSWORD_ID;
  protected readonly showPassword = signal(false);

  private readonly model = signal<LoginV1Command>({
    username: '',
    password: '',
  });
  protected readonly loginForm = form(this.model, (path) => {
    validateStandardSchema(path, LoginV1CommandSchema);
  });

  /** Messages for the two fields, from what the server answered to the form. */
  protected readonly fieldErrors = computed(() => {
    const error = this.store.error$();
    if (!error) return NO_FIELD_ERRORS;
    if (error.kind === 'invalid') {
      const { username, password } = error.details ?? {};
      return {
        username: username ? [username] : [],
        password: password ? [password] : [],
      };
    }
    if (error.kind === 'unauthorized' || error.kind === 'locked') {
      return { username: [], password: [error.message] };
    }
    return NO_FIELD_ERRORS;
  });

  protected readonly summary = computed<Summary | null>(() => {
    const error = this.store.error$();
    if (!error) return null;
    const fields = this.fieldErrors();
    if (error.kind === 'invalid') {
      return {
        heading: error.message,
        items: [
          ...fields.username.map((message) => ({
            controlId: USERNAME_ID,
            message,
          })),
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
          controlId: fields.password.length ? PASSWORD_ID : USERNAME_ID,
          message: error.message,
        },
      ],
    };
  });

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.loginForm, async () => {
      this.store.signIn(this.model());
    });
  }
}

const NO_FIELD_ERRORS: {
  readonly username: readonly string[];
  readonly password: readonly string[];
} = { username: [], password: [] };
