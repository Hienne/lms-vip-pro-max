import { inject, Service } from '@angular/core';
import { Router } from '@angular/router';
import { Toaster } from '@lms/ui';
import { SESSION_EXPIRED_MESSAGE } from '../errors/app-error';
import { returnToParams } from '../routing/return-to';
import { SESSION_ENDED_STATE } from '../routing/unsaved-changes.guard';
import { KeptDrafts } from './kept-drafts';
import { SessionStore } from './session.store';

/**
 * The server ended the session while the user was working: keep the open page's unsaved work,
 * forget the user, say so once, and send them to `/login?next=<where they were>`, where the page
 * offers the work back after sign-in. The 401 interceptor and the dev toolbar's
 * "session expired" simulation both end the session here.
 */
@Service()
export class SessionExpiry {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly drafts = inject(KeptDrafts);

  /** Does nothing for a visitor who is already signed out, so a burst of 401s reports once. */
  end(): void {
    if (!this.session.isSignedIn$()) return;
    const queryParams = returnToParams(this.router.url);
    this.drafts.keepAll();
    this.session.expire();
    this.toaster.info(SESSION_EXPIRED_MESSAGE);
    void this.router.navigate(['/login'], {
      queryParams,
      state: { [SESSION_ENDED_STATE]: true },
    });
  }
}
