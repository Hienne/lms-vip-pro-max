import {
  booleanAttribute,
  Component,
  computed,
  Directive,
  input,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const TONE_ICON: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'circle-check',
  warning: 'triangle-alert',
  danger: 'circle-x',
};

/** Marks projected content (usually buttons) as the alert's actions. */
@Directive({ selector: '[uiAlertAction]' })
export class AlertAction {}

/**
 * An inline message. The tone picks colour and icon, so meaning never rests on colour alone.
 * Live-region role: `alert` for danger, `status` otherwise. Set `announce` to false for an alert
 * that is already on the page at load (static), so it is not announced again.
 *
 * `<ui-alert tone="warning" heading="Còn 3 câu">…<button uiAlertAction uiButton>Xem</button></ui-alert>`
 */
@Component({
  selector: 'ui-alert',
  imports: [Icon],
  host: {
    class: 'alert',
    '[class]': 'modifiers()',
    '[attr.role]': 'role()',
  },
  template: `
    <ui-icon [name]="icon()" />
    <div class="alert__body">
      @if (heading()) {
        <strong class="alert__title">{{ heading() }}</strong>
      }
      <ng-content />
    </div>
    <div class="alert__actions">
      <ng-content select="[uiAlertAction]" />
    </div>
  `,
})
export class Alert {
  readonly tone = input<AlertTone>('info');
  /** Optional bold lead-in above the message. */
  readonly heading = input('');
  /** Whether assistive technology announces the alert when it appears. */
  readonly announce = input(true, { transform: booleanAttribute });

  protected readonly icon = computed(() => TONE_ICON[this.tone()]);
  protected readonly modifiers = computed(() =>
    this.tone() === 'info' ? [] : [`alert--${this.tone()}`],
  );
  protected readonly role = computed(() => {
    if (!this.announce()) return null;
    return this.tone() === 'danger' ? 'alert' : 'status';
  });
}
