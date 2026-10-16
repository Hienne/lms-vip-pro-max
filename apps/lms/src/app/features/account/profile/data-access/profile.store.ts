import { inject, Injectable, signal } from '@angular/core';
import {
  authEndpoints,
  type ChangePasswordCommand,
  type UpdateProfileCommand,
} from '@lms/contracts';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/**
 * The profile page (the mockup's `profile`): the signed-in user, plus the two commands it offers.
 * The user comes from the session, which already holds the profile; after a save the session
 * reloads it, because the mock's PUT body is not the signed-in user (it is stateless). A command
 * the backend refuses shows its message as a toast and leaves the form as it was.
 */
@Injectable()
export class ProfileStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);

  private readonly state = {
    passwordChanges: signal(0),
  };

  private readonly saveMutation = serverMutation(
    (command: UpdateProfileCommand) =>
      this.client.call(authEndpoints.updateProfile, { body: command }),
    {
      errors: 'toast',
      success: () => 'Đã lưu hồ sơ',
      onSuccess: () => this.session.restore(),
    },
  );

  private readonly passwordMutation = serverMutation(
    (command: ChangePasswordCommand) =>
      this.client.call(authEndpoints.changePassword, { body: command }),
    {
      errors: 'toast',
      success: () => 'Đã đổi mật khẩu',
      onSuccess: () =>
        this.setPasswordChanges(this.state.passwordChanges() + 1),
    },
  );

  readonly user$ = this.session.user$;
  /** Counts successful password changes; the form clears itself when it moves. */
  readonly passwordChanges$ = this.state.passwordChanges.asReadonly();

  readonly isSaving$ = this.saveMutation.isPending;
  readonly isChangingPassword$ = this.passwordMutation.isPending;

  private setPasswordChanges(count: number): void {
    this.state.passwordChanges.set(count);
  }

  save(command: UpdateProfileCommand): void {
    this.saveMutation.run(command);
  }

  changePassword(command: ChangePasswordCommand): void {
    this.passwordMutation.run(command);
  }
}
