import { Component, computed, input } from '@angular/core';

/** Colours of the flower, all theme tokens (`--color-<tone>`). */
export type MaiTone = 'accent' | 'on-accent' | 'primary-strong' | 'white';

/**
 * The brand's hoa mai: five round petals around a core. Petal and core colours are theme tokens,
 * never literals. Decorative (hidden from assistive technology) unless given a label.
 */
@Component({
  selector: 'ui-mai',
  host: {
    class: 'mai',
    '[style.--mai-petal]': 'petalVar()',
    '[style.--mai-core]': 'coreVar()',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 40 40"
    aria-hidden="true"
    focusable="false"
  >
    <g class="mai__petals">
      <circle cx="20" cy="8" r="6.5" />
      <circle cx="31.4" cy="16.3" r="6.5" />
      <circle cx="27.1" cy="29.7" r="6.5" />
      <circle cx="12.9" cy="29.7" r="6.5" />
      <circle cx="8.6" cy="16.3" r="6.5" />
    </g>
    <circle class="mai__core" cx="20" cy="20" r="3.5" />
  </svg>`,
})
export class Mai {
  /** Width and height in px. */
  readonly size = input(24);
  readonly petal = input<MaiTone>('accent');
  readonly core = input<MaiTone>('primary-strong');
  /** Accessible name. Leave empty for a decorative flower. */
  readonly label = input('');

  protected readonly petalVar = computed(() => `var(--color-${this.petal()})`);
  protected readonly coreVar = computed(() => `var(--color-${this.core()})`);
}
