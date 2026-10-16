import { computed, linkedSignal, type Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap, type Observable } from 'rxjs';
import { toAppError, type AppError } from '../errors/app-error';
import type { ChangeToken } from './invalidation';

export interface ServerDataOptions {
  /** Tokens that reload the read when bumped. */
  readonly reloadOn?: ChangeToken | readonly ChangeToken[];
}

export interface KeyedServerDataOptions<P> extends ServerDataOptions {
  /**
   * What the read is about, such as a route id. While it returns `undefined` the read stays idle;
   * when it changes the held value is dropped and the read starts again. Compared by value
   * through JSON, so keep it plain data (ids, strings, numbers).
   */
  readonly params: () => P | undefined;
}

export interface ServerData<T> {
  /** The last value the server sent; it stays across a reload, even one that fails. */
  readonly value: Signal<T | undefined>;
  /** True only while no value is held yet: later reloads do not set it. */
  readonly isLoading: Signal<boolean>;
  readonly error: Signal<AppError | undefined>;
  reload(): void;
}

/** Stands in for the params of a read that has none, so it is never idle. */
const UNKEYED = {};

const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * Reads one value from the server. Call it in a store's field initializer, like `rxResource`.
 * Reloads when a `reloadOn` token is bumped or `reload()` is called, and keeps the last value on
 * screen meanwhile; a change of `params` drops it instead.
 */
export function serverData<T>(
  load: () => Observable<T>,
  options?: ServerDataOptions,
): ServerData<T>;
export function serverData<T, P>(
  load: (params: P) => Observable<T>,
  options: KeyedServerDataOptions<P>,
): ServerData<T>;
export function serverData<T, P>(
  load: (params: P) => Observable<T>,
  options: Partial<KeyedServerDataOptions<P>> = {},
): ServerData<T> {
  const tokens = [options.reloadOn ?? []].flat();

  const params = computed(() => (options.params ? options.params() : UNKEYED), {
    equal: sameValue,
  });

  // Reset by a params change; written with the values the server sends for the current params.
  const latest = linkedSignal<unknown, T | undefined>({
    source: params,
    computation: () => undefined,
  });

  const resource = rxResource({
    params: () => {
      const key = params();
      return key === undefined
        ? undefined
        : { key, versions: tokens.map((token) => token.version()) };
    },
    stream: ({ params: { key } }) =>
      // Without `params` the overload gives `load` no argument, so the stand-in is never seen.
      load(key as P).pipe(
        // An answer that lands after the params moved on belongs to the previous key.
        tap((value) => {
          if (sameValue(params(), key)) latest.set(value);
        }),
      ),
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
