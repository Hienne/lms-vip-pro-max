import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  authEndpoints,
  type ChangePasswordCommand,
  type UpdateProfileCommand,
} from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { tap } from 'rxjs';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { toAppError } from '../../../../core/errors/app-error';
import { SessionStore } from '../../../../core/session/session.store';

/**
 * The profile page (the mockup's `profile`): the signed-in user, plus the two commands it offers.
 * The user comes from the session, which already holds the profile; after a save the session
 * reloads it, because Prism's PUT body is not the signed-in user (it is stateless).
 */
@Injectable()
export class ProfileStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly toaster = inject(Toaster);

  private readonly state = {
    saveRequest: signal<UpdateProfileCommand | undefined>(undefined),
    passwordRequest: signal<ChangePasswordCommand | undefined>(undefined),
    passwordChanges: signal(0),
  };

  private readonly saveResource = rxResource({
    params: () => this.state.saveRequest(),
    stream: ({ params: command }) =>
      this.client.call(authEndpoints.updateProfile, { body: command }).pipe(
        tap(() => {
          this.session.restore();
          this.toaster.success('Đã lưu hồ sơ');
        }),
      ),
  });

  private readonly passwordResource = rxResource({
    params: () => this.state.passwordRequest(),
    stream: ({ params: command }) =>
      this.client.call(authEndpoints.changePassword, { body: command }).pipe(
        tap(() => {
          this.setPasswordChanges(this.state.passwordChanges() + 1);
          this.toaster.success('Đã đổi mật khẩu');
        }),
      ),
  });

  readonly user$ = this.session.user$;
  /** Counts successful password changes; the form clears itself when it moves. */
  readonly passwordChanges$ = this.state.passwordChanges.asReadonly();

  readonly isSaving$ = this.saveResource.isLoading;
  readonly saveError$ = computed(() =>
    this.saveResource.error()
      ? toAppError(this.saveResource.error())
      : undefined,
  );
  readonly isChangingPassword$ = this.passwordResource.isLoading;
  readonly passwordError$ = computed(() =>
    this.passwordResource.error()
      ? toAppError(this.passwordResource.error())
      : undefined,
  );

  private setSaveRequest(command: UpdateProfileCommand | undefined): void {
    this.state.saveRequest.set(command);
  }

  private setPasswordRequest(command: ChangePasswordCommand | undefined): void {
    this.state.passwordRequest.set(command);
  }

  private setPasswordChanges(count: number): void {
    this.state.passwordChanges.set(count);
  }

  save(command: UpdateProfileCommand): void {
    this.setSaveRequest({ ...command });
  }

  changePassword(command: ChangePasswordCommand): void {
    this.setPasswordRequest({ ...command });
  }
}
