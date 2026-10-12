import { ErrorHandler, type Provider } from '@angular/core';

/** Reports unexpected errors; never swallows them. Swap the sink for telemetry later. */
class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('Unexpected error', error);
  }
}

export function provideAppErrorHandler(): Provider {
  return { provide: ErrorHandler, useClass: AppErrorHandler };
}
