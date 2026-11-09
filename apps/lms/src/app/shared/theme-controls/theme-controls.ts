import { Component, inject } from '@angular/core';
import { Segmented, type SegmentedOption } from '@lms/ui';
import { ThemeStore, type ThemePreference } from '../../core/theme/theme.store';

/**
 * The look of the app for this browser: Hệ thống / Sáng / Tối. Rendered in the header's theme
 * picker and in the /design-system table of contents; `ThemeStore` owns the choice.
 */
@Component({
  selector: 'app-theme-controls',
  imports: [Segmented],
  templateUrl: './theme-controls.html',
  styleUrl: './theme-controls.scss',
})
export class ThemeControls {
  protected readonly theme = inject(ThemeStore);

  protected readonly modes: readonly SegmentedOption<ThemePreference>[] = [
    { value: 'system', label: 'Hệ thống', icon: 'monitor' },
    { value: 'light', label: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', icon: 'moon' },
  ];
}
