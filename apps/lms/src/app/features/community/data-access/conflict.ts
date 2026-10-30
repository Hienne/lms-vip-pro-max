import type { Dialog } from '@angular/cdk/dialog';
import {
  catchError,
  EMPTY,
  switchMap,
  tap,
  throwError,
  type MonoTypeOperatorFunction,
} from 'rxjs';
import { ApiError } from '../../../core/http/api-error';
import { askAfterConflict } from '../components/conflict-dialog/conflict-dialog';

/** The server refused a write because the version sent is no longer the current one. */
export const isConflict = (error: unknown): boolean =>
  error instanceof ApiError && error.messageCode === 'COMMUNITY-CONFLICT';

/**
 * Turns a version conflict into the "Tải lại" dialog instead of an error toast: the write ends
 * without a value, and `reload` runs when the user chooses to reload. Never retries the write.
 * Other errors pass through to the mutation's own handling.
 */
export function reloadOnConflict<T>(
  dialog: Dialog,
  reload: () => void,
): MonoTypeOperatorFunction<T> {
  return catchError((error: unknown) =>
    isConflict(error)
      ? askAfterConflict(dialog).pipe(
          tap((again) => {
            if (again) reload();
          }),
          switchMap(() => EMPTY),
        )
      : throwError(() => error),
  );
}
