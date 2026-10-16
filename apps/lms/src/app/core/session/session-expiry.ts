import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';
import { Toaster } from '@lms/ui';
import { SESSION_EXPIRED_MESSAGE } from '../errors/app-error';
import { returnToParams } from '../routing/return-to';
import { SessionStore } from './session.store';

/**
 * The server ended the session while the user was working: forget the user, say so once, and
 * send them to `/login?next=<where they were>`. The 401 interceptor and the dev toolbar's
 * "session expired" simulation both end the session here.
 */
@Service()
export class SessionExpiry {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  /** Does nothing for a visitor who is already signed out, so a burst of 401s reports once. */
  end(): void {
    if (!this.session.isSignedIn$()) return;
    const queryParams = returnToParams(this.router.url);
    this.session.expire();
    this.toaster.info(SESSION_EXPIRED_MESSAGE);
    void this.router.navigate(['/login'], { queryParams });
  }
}
