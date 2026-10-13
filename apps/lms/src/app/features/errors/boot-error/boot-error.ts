import { Component, input, output } from '@angular/core';
import { ErrorState } from '@lms/ui';

/**
 * The state the app shows when the session could not be restored for a reason other than being
 * signed out. The root component defers it, so the UI library stays out of the initial bundle.
 */
@Component({
  selector: 'app-boot-error',
  imports: [ErrorState],
  template: `
    <ui-error-state
      [headingLevel]="2"
      title="Không tải được phiên đăng nhập"
      [message]="message()"
      (retry)="retry.emit()"
    />
  `,
})
export class BootError {
  readonly message = input('');
  readonly retry = output<void>();
}
