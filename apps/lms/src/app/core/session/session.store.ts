import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import {
  authEndpoints,
  type LoginCommand,
  type MenuKey,
  type Profile,
} from '@lms/contracts';
import {
  catchError,
  filter,
  firstValueFrom,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { EndpointClient } from '../http/endpoint-client';
import { type AppError, toAppError } from '../errors/app-error';

export type SessionStatus = 'loading' | 'ready' | 'error';

type SignInRequest =
  | { readonly kind: 'password'; readonly command: LoginCommand }
  | { readonly kind: 'demo'; readonly userId: string };

const NO_MENUS: readonly MenuKey[] = [];

/**
 * Who is signed in. The profile from `authEndpoints.profile` is the only source of the role and
 * the menus it grants. The server keeps the session (a cookie today); how a token is stored, attached and
 * refreshed is a separate spec that plugs in behind `signIn`, `signInDemo` and `signOut`.
 * Provided once for the whole app (`provideSession()`), not per component.
 */
@Injectable()
export class SessionStore {
  private readonly client = inject(EndpointClient);

  private readonly state = {
    restoreRequest: signal<object | undefined>(undefined),
    signInRequest: signal<SignInRequest | undefined>(undefined),
    signOutRequest: signal<object | undefined>(undefined),
  };

  /** `null` is an anonymous visitor: the profile answered 401. */
  private readonly profileResource = rxResource<
    Profile | null,
    object | undefined
  >({
    params: () => this.state.restoreRequest(),
    stream: () =>
      this.client
        .call(authEndpoints.profile)
        .pipe(
          catchError((error: unknown) =>
            toAppError(error).kind === 'unauthorized'
              ? of(null)
              : throwError(() => error),
          ),
        ),
  });

  private readonly signInResource = rxResource({
    params: () => this.state.signInRequest(),
    stream: ({ params: request }) =>
      (request.kind === 'demo'
        ? this.client.call(authEndpoints.loginDemo, {
            params: { userId: request.userId },
          })
        : this.client.call(authEndpoints.login, { body: request.command })
      ).pipe(
        switchMap(() => this.client.call(authEndpoints.profile)),
        tap((profile) => this.profileResource.set(profile)),
      ),
  });

  private readonly signOutResource = rxResource({
    params: () => this.state.signOutRequest(),
    stream: () =>
      this.client.call(authEndpoints.logout).pipe(
        catchError(() => of(true as const)),
        tap(() => this.profileResource.set(null)),
      ),
  });

  readonly status$ = computed<SessionStatus>(() => {
    switch (this.profileResource.status()) {
      case 'error':
        return 'error';
      case 'idle':
      case 'loading':
      case 'reloading':
        return 'loading';
      default:
        return 'ready';
    }
  });

  readonly user$ = computed<Profile | null>(() =>
    this.profileResource.hasValue() ? this.profileResource.value() : null,
  );
  readonly menus$ = computed<readonly MenuKey[]>(
    () => this.user$()?.menus ?? NO_MENUS,
  );
  /** Where `/` and the login page send the signed-in user; `null` for a visitor. */
  readonly homePath$ = computed(() => this.user$()?.homePath ?? null);
  readonly isSignedIn$ = computed(() => this.user$() !== null);

  readonly loadError$ = computed<AppError | undefined>(() =>
    this.status$() === 'error'
      ? toAppError(this.profileResource.error())
      : undefined,
  );
  readonly isSigningIn$ = this.signInResource.isLoading;
  readonly signInError$ = computed<AppError | undefined>(() =>
    this.signInResource.error()
      ? toAppError(this.signInResource.error())
      : undefined,
  );
  readonly isSigningOut$ = this.signOutResource.isLoading;

  private readonly statusChanges = toObservable(this.status$);

  private setRestoreRequest(request: object | undefined): void {
    this.state.restoreRequest.set(request);
  }

  private setSignInRequest(request: SignInRequest | undefined): void {
    this.state.signInRequest.set(request);
  }

  private setSignOutRequest(request: object | undefined): void {
    this.state.signOutRequest.set(request);
  }

  /** Loads the profile; the boot initializer calls it, and the error state retries with it. */
  restore(): void {
    this.setRestoreRequest({});
  }

  signIn(command: LoginCommand): void {
    this.setSignInRequest({ kind: 'password', command: { ...command } });
  }

  signInDemo(userId: string): void {
    this.setSignInRequest({ kind: 'demo', userId });
  }

  signOut(): void {
    this.setSignOutRequest({});
  }

  /** The server ended the session: forget the user without calling it (the dev toolbar uses it). */
  expire(): void {
    this.profileResource.set(null);
  }

  /**
   * Resolves once the profile is known (signed in or anonymous). A failed restore keeps guards
   * waiting while the boot error shows, so a successful retry resumes the navigation the user
   * asked for instead of sending them to the login page.
   */
  async whenReady(): Promise<void> {
    await firstValueFrom(
      this.statusChanges.pipe(filter((status) => status === 'ready')),
    );
  }
}
