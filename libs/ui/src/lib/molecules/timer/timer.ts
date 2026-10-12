import { Component, computed, input } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

/**
 * A countdown readout (the mockup's `.timer`): the remaining seconds as `mm:ss`. It has no clock
 * of its own: the caller's store counts down and passes the seconds in. Below `lowAt` it turns to
 * the low state, which also swaps the icon and adds a spoken label so the warning is not colour
 * alone. `aria-live="off"` keeps a screen reader from announcing every second.
 */
@Component({
  selector: 'ui-timer',
  imports: [Icon],
  host: {
    class: 'timer',
    role: 'timer',
    'aria-live': 'off',
    '[class.is-low]': 'low()',
  },
  template: `
    <ui-icon size="sm" [name]="low() ? 'triangle-alert' : 'clock'" />
    <span class="timer__time">{{ text() }}</span>
    @if (low()) {
      <span class="sr-only">{{ lowLabel() }}</span>
    }
  `,
})
export class Timer {
  /** Remaining time in seconds. */
  readonly seconds = input.required<number>();
  /** The low state starts at this many seconds left. */
  readonly lowAt = input(60);
  /** Spoken in the low state. */
  readonly lowLabel = input('Sắp hết giờ');

  protected readonly low = computed(() => this.seconds() <= this.lowAt());
  protected readonly text = computed(() => {
    const total = Math.max(0, Math.round(this.seconds()));
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
}
