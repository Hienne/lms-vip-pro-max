import { Component, computed, input } from '@angular/core';
import { Mai } from '../mai/mai';

/**
 * A circular progress: an SVG arc in token colours with the value in the centre. At 100% the ring
 * blossoms into the hoa mai, as in the mockup. The value is the accessible name
 * ("68% hoàn thành").
 */
@Component({
  selector: 'ui-ring',
  imports: [Mai],
  host: {
    class: 'progress-ring',
    '[class.animate-reward-pop]': 'complete()',
    role: 'img',
    '[attr.aria-label]': 'description()',
    '[style.--ring-size]': 'sizePx()',
  },
  template: `
    @if (complete()) {
      <ui-mai [size]="size() * 0.9" />
    } @else {
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          class="progress-ring__track"
          fill="none"
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          [attr.stroke-width]="stroke()"
        />
        <circle
          class="progress-ring__bar"
          fill="none"
          stroke-linecap="round"
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          [attr.stroke-width]="stroke()"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
        />
      </svg>
      <div class="progress-ring__label" aria-hidden="true">
        <div class="progress-ring__value">{{ rounded() }}%</div>
        <div class="text-xs text-text-muted">{{ label() }}</div>
      </div>
    }
  `,
})
export class Ring {
  /** Percentage, 0 to 100; anything outside is clamped. */
  readonly value = input.required<number>();
  /** Width and height in px. */
  readonly size = input(96);
  readonly stroke = input(9);
  /** Caption under the value. */
  readonly label = input('hoàn thành');

  protected readonly clamped = computed(() =>
    Math.max(0, Math.min(100, this.value())),
  );
  protected readonly rounded = computed(() => Math.round(this.clamped()));
  protected readonly complete = computed(() => this.clamped() >= 100);
  protected readonly sizePx = computed(() => `${this.size()}px`);
  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(
    () => 2 * Math.PI * this.radius(),
  );
  protected readonly offset = computed(
    () => this.circumference() * (1 - this.clamped() / 100),
  );
  protected readonly description = computed(() =>
    this.complete() ? 'Hoàn thành 100%' : `${this.rounded()}% ${this.label()}`,
  );
}
