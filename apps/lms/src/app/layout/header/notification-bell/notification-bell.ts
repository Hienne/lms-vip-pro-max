import { Component, computed, input } from '@angular/core';
import { Icon, IconButton, Popover } from '@lms/ui';
import { BellPanel } from './bell-panel';

/**
 * The header bell opens the recent inbox, with unread notices and pending feedback first.
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
