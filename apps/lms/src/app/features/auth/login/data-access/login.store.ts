import { inject, Injectable } from '@angular/core';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { LoginV1Command } from '@lms/contracts';
import { Toaster } from '@lms/ui';
import { filter, map } from 'rxjs';
import { SessionStore } from '../../../../core/session/session.store';
import {
  readReturnTo,
  SIGN_IN_NAVIGATION,
} from '../../../../core/routing/return-to';

/**
 * The login page: the state of the sign-in the session store runs, and where to go once it
 * succeeds. The page is only reachable while anonymous, so a user appearing in
 * the session while it is open means a sign-in worked.
 */
@Injectable()
export class LoginStore {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);
  private readonly route = inject(ActivatedRoute);

  /** Where the visitor wanted to go, when the guards sent them here. */
  readonly next$ = toSignal(
    this.route.queryParamMap.pipe(map((q) => readReturnTo(q.get('next')))),
    {
      initialValue: readReturnTo(this.route.snapshot.queryParamMap.get('next')),
    },
  );

  readonly isSigningIn$ = this.session.isSigningIn$;
  readonly error$ = this.session.signInError$;

  constructor() {
    toObservable(this.session.user$)
      .pipe(
        filter((user) => user !== null),
        takeUntilDestroyed(),
      )
      .subscribe((user) => {
        this.toaster.success('Đăng nhập thành công');
        void this.router.navigateByUrl(this.next$() ?? user.homePath, {
          info: SIGN_IN_NAVIGATION,
        });
      });
  }

  signIn(command: LoginV1Command): void {
    this.session.signIn(command);
  }
}
