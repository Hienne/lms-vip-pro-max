import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import {
  authV1Endpoints,
  type FunctionCode,
  type LoginV1Command,
  type Me,
} from '@lms/contracts';
import {
  catchError,
  filter,
  firstValueFrom,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { EndpointClient } from '../http/endpoint-client';
import { type AppError, toAppError } from '../errors/app-error';
import type { Profile } from './profile';
import { toProfile } from './to-profile';
import { TokenStore } from './token-store';

export type SessionStatus = 'loading' | 'ready' | 'error';

const NO_MENUS: readonly FunctionCode[] = [];

/**
 * Who is signed in. `/me`, adapted by `toProfile`, is the only source of the user. The access
 * token lives in `TokenStore` and is attached by `bearerInterceptor`; a missing or expired token
 * means an anonymous visitor without asking the server.
 * Provided once for the whole app (`provideSession()`), not per component.
 */
@Injectable()
export class SessionStore {
  private readonly client = inject(EndpointClient);
  private readonly tokens = inject(TokenStore);

  private profileOf(me: Me): Profile {
    return toProfile(me, (endpoint) => this.client.isServed(endpoint));
  }

  private readonly state = {
    restoreRequest: signal<object | undefined>(undefined),
    signInRequest: signal<LoginV1Command | undefined>(undefined),
    signOutRequest: signal<object | undefined>(undefined),
  };

  /** `null` is an anonymous visitor: no valid token, or `/me` answered 401. */
  private readonly profileResource = rxResource<
    Profile | null,
    object | undefined
  >({
    params: () => this.state.restoreRequest(),
    stream: () =>
      this.tokens.read() === null
        ? of(null)
        : this.client.call(authV1Endpoints.me).pipe(
            map((me) => this.profileOf(me)),
            catchError((error: unknown) => {
              if (toAppError(error).kind !== 'unauthorized') {
                return throwError(() => error);
              }
              this.tokens.clear();
              return of(null);
            }),
          ),
  });

  private readonly signInResource = rxResource({
    params: () => this.state.signInRequest(),
    stream: ({ params: command }) =>
      this.client.call(authV1Endpoints.login, { body: command }).pipe(
        tap((token) =>
          this.tokens.save(token.accessToken, token.expiresInSeconds),
        ),
        switchMap(() => this.client.call(authV1Endpoints.me)),
        map((me) => this.profileOf(me)),
        tap((profile) => this.profileResource.set(profile)),
        catchError((error: unknown) => {
          this.tokens.clear();
          return throwError(() => error);
        }),
      ),
  });

  private readonly signOutResource = rxResource({
    params: () => this.state.signOutRequest(),
    stream: () =>
      this.client.call(authV1Endpoints.logout).pipe(
        catchError(() => of(null)),
        tap(() => this.expire()),
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
  readonly menus$ = computed<readonly FunctionCode[]>(
    () => this.user$()?.menus ?? NO_MENUS,
  );
  /** Where `/` and the login page send the signed-in user; `null` for a visitor. */
  readonly homePath$ = computed(() => this.user$()?.homePath ?? null);
  readonly isSignedIn$ = computed(() => this.user$() !== null);
  /** A temporary password is in use: the backend refuses everything but the password change. */
  readonly mustChangePassword$ = computed(
    () => this.user$()?.mustChangePassword ?? false,
  );

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

  private setSignInRequest(request: LoginV1Command | undefined): void {
    this.state.signInRequest.set(request);
  }

  private setSignOutRequest(request: object | undefined): void {
    this.state.signOutRequest.set(request);
  }

  /** Loads the profile; the boot initializer calls it, and the error state retries with it. */
  restore(): void {
    this.setRestoreRequest({});
  }

  signIn(command: LoginV1Command): void {
    this.setSignInRequest({ ...command });
  }

  signOut(): void {
    this.setSignOutRequest({});
  }

  /** Takes a `/me` the server just sent (a profile save answers one) as the signed-in user. */
  apply(me: Me): void {
    this.profileResource.set(this.profileOf(me));
  }

  /** The session ended: forget the token and the user without calling the server. */
  expire(): void {
    this.tokens.clear();
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
