import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { type LoginV1Command } from '@lms/contracts';
import { Alert, Button, Field, Icon, IconButton, Input, Mai } from '@lms/ui';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ChanNetwork } from './components/chan-network/chan-network';
import { LoginStore } from './data-access/login.store';
import { LoginFormSchema } from './login.form';

/** The alert's heading when the backend sent no title for the failure. */
const FAILURE_HEADING = 'Không đăng nhập được';

/** The four pillars the name CHAN stands for (GLOSSARY.md → CHAN Academy), in name order. */
const PILLARS: readonly { word: string; meaning: string }[] = [
  {
    word: 'Connect',
    meaning: 'Kết nối con người, chuyên môn và tri thức giữa các nhóm',
  },
  {
    word: 'Harness',
    meaning:
      'Khai thác và chuyển hóa kinh nghiệm thực tế thành tài sản tri thức',
  },
  {
    word: 'Accelerate',
    meaning: 'Thúc đẩy tốc độ học tập, tiếp cận và làm chủ nghiệp vụ',
  },
  {
    word: 'Nurture',
    meaning: 'Nuôi dưỡng văn hóa học tập, chia sẻ và phát triển năng lực',
  },
];

/** The sign-in page (the mockup's `login`), on the bare layout. */
@Component({
  selector: 'app-login',
  imports: [
    Alert,
    Button,
    ChanNetwork,
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

  protected readonly pillars = PILLARS;
  protected readonly letters = PILLARS.map((pillar) => pillar.word[0]);
  /** The pillar under the pointer, in the list or the picture; both light it. */
  protected readonly activePillar = signal<number | null>(null);
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
