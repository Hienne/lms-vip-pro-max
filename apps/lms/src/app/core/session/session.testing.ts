import type { HttpTestingController } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Me } from '@lms/contracts';
import { envelopeOk, seedMe } from '@lms/mocks';
import type { Profile } from './profile';
import { SessionStore } from './session.store';
import { toProfile } from './to-profile';
import { TokenStore } from './token-store';

export const ME_URL = '/api/v1/auth/me';

/** Stores a valid token, so `restore()` asks `/me` instead of leaving the visitor anonymous. */
export function storeToken(expiresInSeconds = 3600): void {
  TestBed.inject(TokenStore).save('test-token', expiresInSeconds);
}

/** Answers the pending `/me` request with the fixture user. */
export function flushMe(
  backend: HttpTestingController,
  userId = '000004',
): void {
  backend.expectOne(ME_URL).flush(envelopeOk(seedMe(userId)));
}

/**
 * Stands in for `SessionStore` in screen specs that need a particular user: `/me` cannot express
 * what those screens still read (a unit scope, a role's menus, the mock user ids). Provide it with
 * `{ provide: SessionStore, useClass: FakeSessionStore }` and set `user`.
 */
export class FakeSessionStore {
  readonly user = signal<Profile | null>(null);
  readonly user$ = this.user.asReadonly();
  readonly menus$ = computed(() => this.user()?.menus ?? []);
  readonly homePath$ = computed(() => this.user()?.homePath ?? null);
  readonly isSignedIn$ = computed(() => this.user() !== null);
  readonly mustChangePassword$ = computed(
    () => this.user()?.mustChangePassword ?? false,
  );
  readonly status$ = signal('ready').asReadonly();
  readonly loadError$ = signal(undefined).asReadonly();
  readonly isSigningIn$ = signal(false).asReadonly();
  readonly signInError$ = signal(undefined).asReadonly();
  readonly isSigningOut$ = signal(false).asReadonly();
  readonly signIn = vi.fn();
  readonly restore = vi.fn();
  readonly signOut = vi.fn(() => this.user.set(null));
  readonly expire = vi.fn(() => this.user.set(null));
  readonly apply = vi.fn((me: Me) => this.user.set(toProfile(me)));
  readonly whenReady = () => Promise.resolve();
}

/** The profile of a seed user (the backend demo accounts), as `toProfile` builds it from `/me`. */
export function seedProfile(userId: string): Profile {
  return toProfile(seedMe(userId));
}

/** The `FakeSessionStore` the spec provided. */
export function fakeSession(): FakeSessionStore {
  return TestBed.inject(SessionStore) as unknown as FakeSessionStore;
}
