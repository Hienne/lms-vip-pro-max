import { Component, input, output } from '@angular/core';
import { Button } from '../../atoms/button/button.directive';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';
import { Empty, type EmptyHeadingLevel, type EmptyTone } from '../empty/empty';

/**
 * Renders any failure as an {@link Empty} block. The app passes the title and message of its
 * error in; a retry button emits `retry`, and the projected content is the optional secondary
 * action (for example a link home).
 */
@Component({
  selector: 'ui-error-state',
  imports: [Empty, Button, Icon],
  template: `
    <ui-empty
      [icon]="icon()"
      [tone]="tone()"
      [title]="title()"
      [description]="message()"
      [headingLevel]="headingLevel()"
    >
      <div class="error-state__actions">
        @if (retryable()) {
          <button uiButton variant="primary" (click)="retry.emit()">
            <ui-icon name="refresh-cw" size="sm" />{{ retryLabel() }}
          </button>
        }
        <ng-content />
      </div>
    </ui-empty>
  `,
})
export class ErrorState {
  readonly icon = input<IconName>('triangle-alert');
  readonly tone = input<EmptyTone>('danger');
  readonly title = input('Đã có lỗi xảy ra');
  readonly message = input('Vui lòng thử lại sau.');
  readonly headingLevel = input<EmptyHeadingLevel>(3);
  /** Whether retrying makes sense for this failure; hides the retry button when false. */
  readonly retryable = input(true);
  readonly retryLabel = input('Thử lại');
  readonly retry = output<void>();
}
