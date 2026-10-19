import { Component, inject } from '@angular/core';
import {
  Segmented,
  SwatchGroup,
  type SegmentedOption,
  type SwatchOption,
} from '@lms/ui';
import {
  THEME_PALETTES,
  ThemeStore,
  type ThemePalette,
  type ThemePreference,
} from '../../core/theme/theme.store';

const PALETTE_LABEL: Readonly<Record<ThemePalette, string>> = {
  bidv: 'BIDV chuẩn',
  'bidv-soft': 'BIDV dịu',
  blue: 'Xanh dương',
  sand: 'Cát ấm',
};

/**
 * The look of the app for this browser: a colour palette and Hệ thống / Sáng / Tối. Rendered in the
 * header's theme picker and in the /design-system table of contents; `ThemeStore` owns both choices.
 * Each swatch reads the palette's constant swatch tokens, so all four show whatever is active.
 */
@Component({
  selector: 'app-theme-controls',
  imports: [Segmented, SwatchGroup],
  templateUrl: './theme-controls.html',
  styleUrl: './theme-controls.scss',
})
export class ThemeControls {
  protected readonly theme = inject(ThemeStore);

  protected readonly palettes: readonly SwatchOption<ThemePalette>[] =
    THEME_PALETTES.map((palette) => ({
      value: palette,
      label: PALETTE_LABEL[palette],
      swatch: {
        fill: `swatch-${palette}-fill`,
        base: `swatch-${palette}-base`,
      },
    }));

  protected readonly modes: readonly SegmentedOption<ThemePreference>[] = [
    { value: 'system', label: 'Hệ thống', icon: 'monitor' },
    { value: 'light', label: 'Sáng', icon: 'sun' },
    { value: 'dark', label: 'Tối', icon: 'moon' },
  ];
}
