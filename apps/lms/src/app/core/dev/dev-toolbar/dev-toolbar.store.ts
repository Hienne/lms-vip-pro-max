import { inject, Injectable, Injector, signal } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { DemoAccount } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { filter, take } from 'rxjs';
import { AuthApi } from '../../auth/auth.api';
import { NetworkStore } from '../../network/network.store';
import { SessionStore } from '../../session/session.store';
import { roleLabel } from '../../../shared/status/role-badge';
import { MockScenario } from '../mock-scenario';

/** The `@lms/mocks` example that stands for a demo account (a unit admin has its own). */
export const exampleOf = (account: DemoAccount): string =>
  account.adminScope ? 'unit-admin' : account.role;

/**
 * What the dev toolbar does, replacing the mockup's "Demo" menu: switch the signed-in role,
 * simulate a lost connection or an expired session, try a forbidden URL. The demo accounts load
 * the first time the toolbar is touched, so an idle page makes no extra request.
 */
@Injectable()
export class DevToolbarStore {
  private readonly session = inject(SessionStore);
  private readonly network = inject(NetworkStore);
  private readonly scenario = inject(MockScenario);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly api = inject(AuthApi);
  private readonly injector = inject(Injector);

  private readonly state = { wanted: signal(false) };

  private readonly accountsResource = rxResource({
    params: () => (this.state.wanted() ? {} : undefined),
    stream: () => this.api.demoAccounts(),
  });

  readonly accounts$ = () =>
    this.accountsResource.hasValue() ? this.accountsResource.value() : [];
  readonly currentId$ = () => this.session.user$()?.id ?? null;
  readonly offline$ = this.network.offline$;

  /** Starts loading the demo accounts (idempotent). */
  load(): void {
    this.state.wanted.set(true);
  }

  switchRole(account: DemoAccount): void {
    this.scenario.setRole(exampleOf(account));
    this.session.signInDemo(account.id);
    toObservable(this.session.user$, { injector: this.injector })
      .pipe(
        filter((user) => user?.id === account.id),
        take(1),
      )
      .subscribe(() => {
        const label =
          roleLabel(account.role) + (account.adminScope ? ' đơn vị' : '');
        this.toaster.info(`Đã chuyển sang ${label}`, account.email);
        void this.router.navigateByUrl('/');
      });
  }

  toggleOffline(): void {
    if (this.network.offline$()) this.network.goOnline();
    else this.network.goOffline();
  }

  /** The session ends now: the user is forgotten and the login page asks to come back here. */
  expireSession(): void {
    const next = this.router.url;
    this.session.expire();
    this.toaster.info('Phiên đăng nhập đã hết hạn');
    void this.router.navigate(['/login'], { queryParams: { next } });
  }

  tryAdminUrl(): void {
    void this.router.navigateByUrl('/admin/users');
  }

  openDesignSystem(): void {
    void this.router.navigateByUrl('/design-system');
  }
}
