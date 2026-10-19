import { Component } from '@angular/core';
import { Icon, IconButton, Popover } from '@lms/ui';
import { ThemeControls } from '../../../shared/theme-controls/theme-controls';

/**
 * The header's palette button: opens the theme controls (palette and Hệ thống / Sáng / Tối) in a
 * popover. A choice applies at once and the panel stays open so palettes can be compared.
 */
@Component({
  selector: 'app-theme-picker',
  imports: [Icon, IconButton, Popover, ThemeControls],
  template: `
    <button
      uiIconButton
      label="Tùy chỉnh giao diện"
      popoverLabel="Tùy chỉnh giao diện"
      [uiPopover]="panel"
    >
      <ui-icon name="palette" />
    </button>
    <ng-template #panel>
      <app-theme-controls />
    </ng-template>
  `,
})
export class ThemePicker {}
