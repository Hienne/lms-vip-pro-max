import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { NetworkStore } from '../../network/network.store';
import { SessionExpiry } from '../../session/session-expiry';
import { screenHref } from '../../routing/screens';

/**
 * What the dev toolbar does, replacing the mockup's "Demo" menu: simulate a lost connection or an
 * expired session, try a forbidden URL.
 */
@Injectable()
export class DevToolbarStore {
  private readonly network = inject(NetworkStore);
  private readonly sessionExpiry = inject(SessionExpiry);
  private readonly router = inject(Router);

  readonly offline$ = this.network.offline$;

  toggleOffline(): void {
    if (this.network.offline$()) this.network.goOnline();
    else this.network.goOffline();
  }

  /** The session ends now, exactly as when the server answers 401 (see `SessionExpiry`). */
  expireSession(): void {
    this.sessionExpiry.end();
  }

  tryAdminUrl(): void {
    void this.router.navigateByUrl(screenHref('admin/users'));
  }

  openDesignSystem(): void {
    void this.router.navigateByUrl('/design-system');
  }
}
