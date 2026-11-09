import { Component } from '@angular/core';
import { Icon, IconButton, Popover } from '@lms/ui';
import { ThemeControls } from '../../../shared/theme-controls/theme-controls';

/**
 * The header's theme button: opens the theme controls (Hệ thống / Sáng / Tối) in a popover. A
 * choice applies at once.
 */
@Component({
  selector: 'app-theme-picker',
  imports: [Icon, IconButton, Popover, ThemeControls],
  template: `
    <button
      uiIconButton
      label="Chế độ giao diện"
      popoverLabel="Chế độ giao diện"
      [uiPopover]="panel"
    >
      <ui-icon name="sun" />
    </button>
    <ng-template #panel>
      <app-theme-controls />
    </ng-template>
  `,
})
export class ThemePicker {}
