import { computed, inject, signal, type Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Toaster } from '@lms/ui';
import { tap, type Observable } from 'rxjs';
import { toAppError, type AppError } from '../errors/app-error';
import type { Invalidation } from './invalidation';

/** A toast title, or a title plus a detail line. */
export type SuccessMessage =
  | string
  | { readonly title: string; readonly detail?: string };

export interface ServerMutationOptions<I, R> {
  /**
   * Where a failure goes: `'toast'` shows the backend's title and message as an error toast,
   * `'alert'` exposes it as `error` for the view to show in a `ui-alert`. Required so the policy
   * is always visible.
   */
  readonly errors: 'toast' | 'alert';
  /** The success toast, from what was sent and what came back. */
  readonly success: (input: I, result: R) => SuccessMessage;
  /** Runs first on success, before the invalidations and the toast: close a drawer, navigate. */
  readonly onSuccess?: (result: R) => void;
  /** Bumped on success, so the reads that reload on them refresh. */
  readonly invalidates?: Invalidation | readonly Invalidation[];
}

export interface ServerMutation<I> {
  /** Starts the call. A new run cancels the one in flight. */
  run(input: I): void;
  readonly isPending: Signal<boolean>;
  /** The last failure; meaningful for `errors: 'alert'`. */
  readonly error: Signal<AppError | undefined>;
  /** Forgets the last request and its error, e.g. when a drawer reopens. */
  reset(): void;
}

/**
 * Runs one command against the server. Call it in a store's field initializer, like `rxResource`.
 * On success it runs `onSuccess`, bumps `invalidates`, then shows the success toast.
 */
export function serverMutation<I, R>(
  run: (input: I) => Observable<R>,
  options: ServerMutationOptions<I, R>,
): ServerMutation<I> {
  const toaster = inject(Toaster);
  const invalidates = [options.invalidates ?? []].flat();
  const request = signal<{ readonly input: I } | undefined>(undefined);

  const resource = rxResource({
    params: () => request(),
    stream: ({ params }) =>
      run(params.input).pipe(
        tap({
          next: (result) => {
            options.onSuccess?.(result);
            invalidates.forEach((token) => token.bump());
            const message = options.success(params.input, result);
            if (typeof message === 'string') toaster.success(message);
            else toaster.success(message.title, message.detail);
          },
          error: (error: unknown) => {
            if (options.errors === 'toast') {
              const { title, message, httpStatus, responseId } =
                toAppError(error);
              // A system failure (HTTP 5xx) carries the id support looks the call up by.
              const detail =
                responseId && httpStatus && httpStatus >= 500
                  ? `${message} Mã tra cứu: ${responseId}`
                  : message;
              if (title) toaster.error(title, detail);
              else toaster.error(detail);
            }
          },
        }),
      ),
  });

  const error = computed(() => {
    const failure = resource.error();
    return failure ? toAppError(failure) : undefined;
  });

  return {
    // A fresh object each time, so resubmitting the same input calls the server again.
    run: (input) => request.set({ input }),
    isPending: resource.isLoading,
    error,
    reset: () => request.set(undefined),
  };
}
