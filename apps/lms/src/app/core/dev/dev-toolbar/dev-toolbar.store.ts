import {
  DestroyRef,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import {
  rxResource,
  takeUntilDestroyed,
  toObservable,
} from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { authEndpoints, type DemoAccount } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { filter, take } from 'rxjs';
import { EndpointClient } from '../../http/endpoint-client';
import { NetworkStore } from '../../network/network.store';
import { SessionExpiry } from '../../session/session-expiry';
import { SessionStore } from '../../session/session.store';
import { isUnitAdmin, roleText } from '../../../shared/status/role-badge';
import { MockScenario } from '../mock-scenario';
import { screenHref } from '../../routing/screens';

/** The `@lms/mocks` example that stands for a demo account (a unit admin has its own). */
export const exampleOf = (account: DemoAccount): string =>
  isUnitAdmin(account) ? 'unit-admin' : account.roleId;

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
  private readonly sessionExpiry = inject(SessionExpiry);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly client = inject(EndpointClient);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state = { wanted: signal(false) };

  private readonly accountsResource = rxResource({
    params: () => (this.state.wanted() ? {} : undefined),
    stream: () => this.client.call(authEndpoints.demoAccounts),
  });

  readonly accounts$ = () =>
    this.accountsResource.hasValue() ? this.accountsResource.value() : [];
  readonly currentId$ = () => this.session.user$()?.id ?? null;
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
    this.session.signInDemo(account.id);
    toObservable(this.session.user$, { injector: this.injector })
      .pipe(
        filter((user) => user?.id === account.id),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.toaster.info(`Đã chuyển sang ${roleText(account)}`, account.email);
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
