import { computed, inject, Injectable, signal } from '@angular/core';
import {
  rxResource,
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  authEndpoints,
  type DemoAccount,
  type LoginCommand,
} from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { filter, map } from 'rxjs';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { toAppError } from '../../../../core/errors/app-error';
import { SessionStore } from '../../../../core/session/session.store';
import { readReturnTo } from '../../../../core/routing/return-to';

const NO_ACCOUNTS: readonly DemoAccount[] = [];

/** Where the last attempt came from: the form puts server messages on its fields, a demo card cannot. */
export type SignInSource = 'form' | 'demo';

/**
 * The login page: the demo accounts to offer, the state of the sign-in the session store runs, and
 * where to go once it succeeds. The page is only reachable while anonymous, so a user appearing in
 * the session while it is open means a sign-in worked.
 */
@Injectable()
export class LoginStore {
  private readonly session = inject(SessionStore);
  private readonly client = inject(EndpointClient);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly route = inject(ActivatedRoute);

  private readonly state = { source: signal<SignInSource>('form') };

  private readonly accountsResource = rxResource({
    stream: () => this.client.call(authEndpoints.demoAccounts),
  });

  /** Where the visitor wanted to go, when the guards sent them here. */
  readonly next$ = toSignal(
    this.route.queryParamMap.pipe(map((q) => readReturnTo(q.get('next')))),
    {
      initialValue: readReturnTo(this.route.snapshot.queryParamMap.get('next')),
    },
  );

  readonly accounts$ = computed(() =>
    this.accountsResource.hasValue()
      ? this.accountsResource.value()
      : NO_ACCOUNTS,
  );
  readonly accountsError$ = computed(() =>
    this.accountsResource.error()
      ? toAppError(this.accountsResource.error())
      : undefined,
  );
  readonly isSigningIn$ = this.session.isSigningIn$;
  readonly error$ = this.session.signInError$;
  readonly source$ = this.state.source.asReadonly();

  constructor() {
    toObservable(this.session.user$)
      .pipe(
        filter((user) => user !== null),
        takeUntilDestroyed(),
      )
      .subscribe((user) => {
        this.toaster.success('Đăng nhập thành công');
        void this.router.navigateByUrl(this.next$() ?? user.homePath);
      });
  }

  private setSource(source: SignInSource): void {
    this.state.source.set(source);
  }

  signIn(command: LoginCommand): void {
    this.setSource('form');
    this.session.signIn(command);
  }

  signInDemo(userId: string): void {
    this.setSource('demo');
    this.session.signInDemo(userId);
  }
}
