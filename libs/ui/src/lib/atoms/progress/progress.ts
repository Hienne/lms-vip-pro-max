import { Component, computed, input } from '@angular/core';

export type ProgressTone = 'success' | 'warning' | 'danger' | 'reward';
export type ProgressSize = 'sm' | 'md';

/** A horizontal progress bar. `value` is a percentage; the bar width is a CSS variable. */
@Component({
  selector: 'ui-progress',
  host: {
    class: 'progress',
    '[class]': 'modifiers()',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'rounded()',
    '[attr.aria-label]': 'label()',
    '[style.--value]': 'width()',
  },
  template: `<div class="progress__bar"></div>`,
})
export class Progress {
  /** Percentage, 0 to 100; anything outside is clamped. */
  readonly value = input.required<number>();
  /** Success, warning, danger or reward; the primary colour when omitted. */
  readonly tone = input<ProgressTone>();
  readonly size = input<ProgressSize>('md');
  /** Accessible name; say what progresses ("Tiến độ Tổng quan Core Banking"). */
  readonly label = input('Tiến độ');

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(100, this.value())),
  );
  protected readonly rounded = computed(() => Math.round(this.clamped()));
  protected readonly width = computed(() => `${this.clamped()}%`);
  protected readonly modifiers = computed(() =>
    [
      this.size() === 'sm' ? 'progress--sm' : '',
      this.tone() ? `progress--${this.tone()}` : '',
    ].filter(Boolean),
  );
}
