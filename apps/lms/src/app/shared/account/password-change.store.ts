import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { authV1Endpoints, type ChangePasswordV1Command } from '@lms/contracts';
import { serverMutation } from '../../core/data-access/server-mutation';
import { EndpointClient } from '../../core/http/endpoint-client';
import { SessionStore } from '../../core/session/session.store';

/**
 * Changes the signed-in user's password. The backend revokes every token on success, so the
 * session ends and the user signs in again with the new password; a refusal (wrong current
 * password, a rule the form missed) is a toast and leaves the form as it was.
 * Provided by the screen that shows the form.
 */
@Injectable()
export class PasswordChangeStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  private readonly changeMutation = serverMutation(
    (command: ChangePasswordV1Command) =>
      this.client.call(authV1Endpoints.changePassword, { body: command }),
    {
      errors: 'toast',
      success: () => ({
        title: 'Đã đổi mật khẩu',
        detail: 'Vui lòng đăng nhập lại bằng mật khẩu mới.',
      }),
      onSuccess: () => {
        this.session.expire();
        void this.router.navigateByUrl('/login');
      },
    },
  );

  readonly isChanging$ = this.changeMutation.isPending;

  change(command: ChangePasswordV1Command): void {
    this.changeMutation.run(command);
  }
}
