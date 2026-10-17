import { Component, inject } from '@angular/core';
import { Alert, Button, Icon, Mai } from '@lms/ui';
import { PasswordChangeStore } from '../../../shared/account/password-change.store';
import { PasswordForm } from '../../../shared/account/password-form/password-form';
import { SessionStore } from '../../../core/session/session.store';

/**
 * The password change a user must make after signing in with a temporary password (an account an
 * administrator just created). Every other screen sends them here until it is done, because the
 * backend refuses their other calls. Also usable by anyone who wants to change their password.
 */
@Component({
  selector: 'app-change-password',
  imports: [Alert, Button, Icon, Mai, PasswordForm],
  providers: [PasswordChangeStore],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  protected readonly store = inject(PasswordChangeStore);
  private readonly session = inject(SessionStore);

  protected readonly forced = this.session.mustChangePassword$;
  protected readonly user = this.session.user$;

  protected signOut(): void {
    this.session.signOut();
  }
}
