import { ErrorHandler, inject, Injector, type Provider } from '@angular/core';
import { isStaleBuildError, offerReload } from './stale-build';

/**
 * Reports unexpected errors; never swallows them. Swap the sink for telemetry later. A lazy chunk
 * of an older build (the tab outlived a deploy) also offers a reload.
 */
class AppErrorHandler implements ErrorHandler {
  private readonly injector = inject(Injector);

  handleError(error: unknown): void {
    console.error('Unexpected error', error);
    if (isStaleBuildError(error)) offerReload(this.injector);
  }
}

export function provideAppErrorHandler(): Provider {
  return { provide: ErrorHandler, useClass: AppErrorHandler };
}
