import { Component, computed, input } from '@angular/core';
import { Icon, IconButton, Popover } from '@lms/ui';
import { BellPanel } from './bell-panel';

/**
 * The header bell. A click opens a short list of what waits for the user (due reminders for a
 * learner, unanswered questions for an instructor) with a link to the full notifications page; it
 * no longer navigates by itself. The dot says something is unread.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [BellPanel, Icon, IconButton, Popover],
  template: `
    <button
      uiIconButton
      #pop="uiPopover"
      [dot]="unread() > 0"
      [label]="label()"
      popoverLabel="Thông báo"
      [uiPopover]="panel"
    >
      <ui-icon name="bell" />
    </button>
    <ng-template #panel>
      <app-bell-panel (navigated)="pop.close()" />
    </ng-template>
  `,
})
export class NotificationBell {
  readonly unread = input(0);

  protected readonly label = computed(() =>
    this.unread() > 0 ? `Thông báo, ${this.unread()} chưa đọc` : 'Thông báo',
  );
}
