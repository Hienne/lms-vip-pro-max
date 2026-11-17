import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type LoginV1Command } from '@lms/contracts';
import {
  Alert,
  Button,
  Field,
  Icon,
  type IconName,
  IconButton,
  Input,
  Mai,
} from '@lms/ui';
import { APP_CONFIG } from '../../../core/config/app-config';
import { LoginStore } from './data-access/login.store';
import { LoginFormSchema } from './login.form';

/** The alert's heading when the backend sent no title for the failure. */
const FAILURE_HEADING = 'Không đăng nhập được';

const BRAND_POINTS: readonly { icon: IconName; text: string }[] = [
  {
    icon: 'book-open',
    text: 'Tài liệu PDF, video, quy trình và bài kiểm tra trên cùng nền tảng',
  },
  {
    icon: 'history',
    text: 'Tiếp tục học đúng trang, đúng mốc video trên mọi thiết bị',
  },
  { icon: 'target', text: 'Xem kết quả đánh giá theo từng nhóm năng lực' },
];

/** The sign-in page (the mockup's `login`), on the bare layout. */
@Component({
  selector: 'app-login',
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
  ],
  providers: [LoginStore],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  protected readonly store = inject(LoginStore);

  /** The mockup line and design-system link are for development and demo builds only. */
  protected readonly showNote = inject(APP_CONFIG).devTools;

  protected readonly brandPoints = BRAND_POINTS;
  protected readonly failureHeading = FAILURE_HEADING;
  protected readonly showPassword = signal(false);

  private readonly model = signal<LoginV1Command>({
    username: '',
    password: '',
  });
  protected readonly loginForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, LoginFormSchema);
    },
    {
      submission: {
        action: async () => {
          const { username, password } = this.model();
          this.store.signIn({ username: username.trim(), password });
        },
      },
    },
  );

  protected togglePassword(): void {
    this.showPassword.update((shown) => !shown);
  }
}
