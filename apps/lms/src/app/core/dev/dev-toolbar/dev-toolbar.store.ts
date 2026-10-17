import { inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { authEndpoints, type DemoAccount } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { EndpointClient } from '../../http/endpoint-client';
import { NetworkStore } from '../../network/network.store';
import { SessionExpiry } from '../../session/session-expiry';
import { isUnitAdmin, roleText } from '../../../shared/status/role-badge';
import { MockScenario } from '../mock-scenario';
import { screenHref } from '../../routing/screens';

/** The `@lms/mocks` example that stands for a demo account (a unit admin has its own). */
export const exampleOf = (account: DemoAccount): string =>
  isUnitAdmin(account) ? 'unit-admin' : account.roleId;

/**
 * What the dev toolbar does, replacing the mockup's "Demo" menu: switch the mock data's role,
 * simulate a lost connection or an expired session, try a forbidden URL. The demo accounts load
 * the first time the toolbar is touched, so an idle page makes no extra request.
 */
@Injectable()
export class DevToolbarStore {
  private readonly network = inject(NetworkStore);
  private readonly scenario = inject(MockScenario);
  private readonly sessionExpiry = inject(SessionExpiry);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly client = inject(EndpointClient);

  private readonly state = { wanted: signal(false) };

  private readonly accountsResource = rxResource({
    params: () => (this.state.wanted() ? {} : undefined),
    stream: () => this.client.call(authEndpoints.demoAccounts),
  });

  readonly accounts$ = () =>
    this.accountsResource.hasValue() ? this.accountsResource.value() : [];
  /** The mock role in use, as the example name `exampleOf` gives. */
  readonly currentRole$ = this.scenario.role$;
  readonly offline$ = this.network.offline$;

  /** Starts loading the demo accounts (idempotent). */
  load(): void {
    this.setWanted(true);
  }

  private setWanted(wanted: boolean): void {
    this.state.wanted.set(wanted);
  }

  switchRole(account: DemoAccount): void {
    this.scenario.setRole(exampleOf(account));
    this.toaster.info(
      `Đã chuyển dữ liệu mô phỏng sang ${roleText(account)}`,
      'Chỉ đổi dữ liệu mock; người đăng nhập không đổi.',
    );
    void this.router.navigateByUrl('/');
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
