import { Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import { ICONS, type IconName } from './icon-registry';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/** The mockup's stroke width for every icon. */
const STROKE_WIDTH = 1.75;

/**
 * A Lucide icon by registered name. The only wrapper around `@lucide/angular`.
 * Decorative by default (hidden from assistive technology); pass `label` for an icon that stands
 * alone, which makes it an image with that accessible name.
 */
@Component({
  selector: 'ui-icon',
  imports: [LucideDynamicIcon],
  host: {
    class: 'icon',
    '[class]': 'modifier()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `<svg
    [lucideIcon]="data()"
    size="100%"
    [strokeWidth]="strokeWidth"
  ></svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('md');
  /** Accessible name. Leave empty for a decorative icon. */
  readonly label = input('');

  protected readonly strokeWidth = STROKE_WIDTH;
  protected readonly data = computed(() => ICONS[this.name()]);
  protected readonly modifier = computed(() =>
    this.size() === 'md' ? '' : `icon--${this.size()}`,
  );
}
