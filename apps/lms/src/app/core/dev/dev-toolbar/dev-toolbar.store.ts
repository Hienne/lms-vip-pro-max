import { computed, inject, Injectable, Injector } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Toaster } from '@lms/ui';
import { filter, take } from 'rxjs';
import { NetworkStore } from '../../network/network.store';
import { SessionExpiry } from '../../session/session-expiry';
import { SessionStore } from '../../session/session.store';
import { screenHref } from '../../routing/screens';
import {
  MOCK_ACCOUNTS,
  MOCK_PASSWORD,
  type MockAccount,
} from '../mock-api/mock-accounts';

/**
 * What the dev toolbar does, replacing the mockup's "Demo" menu: sign in as one of the mock
 * backend's demo users, simulate a lost connection or an expired session, try a forbidden URL.
 */
@Injectable()
export class DevToolbarStore {
  private readonly network = inject(NetworkStore);
  private readonly session = inject(SessionStore);
  private readonly sessionExpiry = inject(SessionExpiry);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly injector = inject(Injector);

  readonly accounts: readonly MockAccount[] = MOCK_ACCOUNTS;
  /** The staff code of the signed-in user, to mark them in the list. */
  readonly currentUserId$ = computed(
    () => this.session.user$()?.userId ?? null,
  );
  readonly offline$ = this.network.offline$;

  /** Signs in as a demo user of the mock backend and opens their home. */
  signInAs(account: MockAccount): void {
    this.session.signIn({
      username: account.username,
      password: MOCK_PASSWORD,
    });
    toObservable(this.session.user$, { injector: this.injector })
      .pipe(
        filter((user) => user?.userId === account.userId),
        take(1),
      )
      .subscribe(() => {
        this.toaster.info(
          `Đã đăng nhập bằng ${account.fullName}`,
          account.roleText,
        );
        void this.router.navigateByUrl('/');
      });
  }

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
