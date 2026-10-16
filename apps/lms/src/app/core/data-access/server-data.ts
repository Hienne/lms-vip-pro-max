import { computed, signal, type Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap, type Observable } from 'rxjs';
import { toAppError, type AppError } from '../errors/app-error';
import type { ChangeToken } from './invalidation';

export interface ServerDataOptions {
  /** Tokens that reload the read when bumped. */
  readonly reloadOn?: ChangeToken | readonly ChangeToken[];
}

export interface ServerData<T> {
  /** The last value the server sent; it stays across a reload, even one that fails. */
  readonly value: Signal<T | undefined>;
  /** True only while no value is held yet: later reloads do not set it. */
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<AppError | undefined>;
  reload(): void;
}

/**
 * Reads one value from the server. Call it in a store's field initializer, like `rxResource`.
 * Reloads when a `reloadOn` token is bumped or `reload()` is called, and keeps the last value on
 * screen meanwhile.
 */
export function serverData<T>(
  load: () => Observable<T>,
  options: ServerDataOptions = {},
): ServerData<T> {
  const tokens = [options.reloadOn ?? []].flat();

  const latest = signal<T | undefined>(undefined);

  const resource = rxResource({
    params: () => ({ versions: tokens.map((token) => token.version()) }),
    stream: () => load().pipe(tap((value) => latest.set(value))),
  });

  return {
    value: latest.asReadonly(),
    isLoading: computed(() => resource.isLoading() && latest() === undefined),
    error: computed(() => {
      const error = resource.error();
      return error ? toAppError(error) : undefined;
    }),
    reload: () => {
      resource.reload();
    },
  };
}
