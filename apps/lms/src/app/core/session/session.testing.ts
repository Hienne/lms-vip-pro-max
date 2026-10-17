import type { HttpTestingController } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Profile } from '@lms/contracts';
import { meV1Body } from '@lms/mocks';
import { SessionStore } from './session.store';
import { TokenStore } from './token-store';

export const ME_URL = '/api/v1/auth/me';

/** Stores a valid token, so `restore()` asks `/me` instead of leaving the visitor anonymous. */
export function storeToken(expiresInSeconds = 3600): void {
  TestBed.inject(TokenStore).save('test-token', expiresInSeconds);
}

/** Answers the pending `/me` request with the fixture user. */
export function flushMe(backend: HttpTestingController): void {
  backend.expectOne(ME_URL).flush(meV1Body);
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
  readonly status$ = signal('ready').asReadonly();
  readonly loadError$ = signal(undefined).asReadonly();
  readonly isSigningOut$ = signal(false).asReadonly();
  readonly restore = vi.fn();
  readonly signOut = vi.fn();
  readonly expire = vi.fn(() => this.user.set(null));
  readonly whenReady = () => Promise.resolve();
}

/** The `FakeSessionStore` the spec provided. */
export function fakeSession(): FakeSessionStore {
  return TestBed.inject(SessionStore) as unknown as FakeSessionStore;
}
