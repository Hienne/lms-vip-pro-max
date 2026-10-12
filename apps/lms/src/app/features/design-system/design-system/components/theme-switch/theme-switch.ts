import { Component, inject } from '@angular/core';
import { Segmented, type SegmentedOption } from '@lms/ui';
import {
  ThemeStore,
  type ThemePreference,
} from '../../../../../core/theme/theme.store';

/** Hệ thống / Sáng / Tối: the theme choice, kept in the table of contents until the app header exists. */
@Component({
  selector: 'app-theme-switch',
  imports: [Segmented],
  template: `<ui-segmented
    label="Giao diện"
    [options]="options"
    [value]="theme.preference$()"
    (valueChange)="theme.setPreference($event)"
  />`,
})
export class ThemeSwitch {
  protected readonly theme = inject(ThemeStore);
  protected readonly options: readonly SegmentedOption<ThemePreference>[] = [
    { value: 'system', label: 'Hệ thống', icon: 'monitor' },
    { value: 'light', label: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', icon: 'moon' },
  ];
}
