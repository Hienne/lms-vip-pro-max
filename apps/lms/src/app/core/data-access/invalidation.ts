import { signal, type Signal } from '@angular/core';

/** What a reader needs from an {@link Invalidation}: the version it reloads on. */
export interface ChangeToken {
  readonly version: Signal<number>;
}

/** A change token. The owner bumps it after an accepted change; data reads reload on it. */
export interface Invalidation extends ChangeToken {
  bump(): void;
}

/**
 * Creates a change token. Hand it to a store's mutations as `invalidates` and to its reads as
 * `reloadOn`; share it with another store as a {@link ChangeToken}, which cannot bump.
 */
export function invalidation(): Invalidation {
  const version = signal(0);
  return {
    version: version.asReadonly(),
    bump: () => version.update((v) => v + 1),
  };
}
