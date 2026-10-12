import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '../../atoms/card/card.directive';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export type KpiTone = 'primary' | 'reward' | 'warning' | 'danger' | 'info';

/**
 * Dashboard tile (the mockup's `UI.Kpi`): a toned icon, a big value with an optional suffix, a
 * label and an optional delta, inside a card. With `href` the whole card is one router link whose
 * accessible name is the tile's own text.
 */
@Component({
  selector: 'ui-kpi',
  imports: [NgTemplateOutlet, RouterLink, Card, Icon],
  host: { class: 'kpi-host' },
  template: `
    <ng-template #content>
      <div class="kpi">
        <div class="kpi__icon" [class]="iconModifier()">
          <ui-icon [name]="icon()" />
        </div>
        <div class="kpi__body">
          <div class="kpi__value">
            {{ value() }}
            @if (suffix()) {
              <small>{{ suffix() }}</small>
            }
          </div>
          <div class="kpi__label">{{ label() }}</div>
          @if (delta()) {
            <div class="kpi__delta">{{ delta() }}</div>
          }
        </div>
      </div>
    </ng-template>
    @if (href(); as target) {
      <a uiCard interactive [routerLink]="target">
        <ng-container *ngTemplateOutlet="content" />
      </a>
    } @else {
      <div uiCard>
        <ng-container *ngTemplateOutlet="content" />
      </div>
    }
  `,
})
export class Kpi {
  readonly icon = input.required<IconName>();
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly suffix = input<string>();
  readonly delta = input<string>();
  readonly tone = input<KpiTone>('primary');
  /** Router link target; makes the whole tile a link. */
  readonly href = input<string>();

  protected readonly iconModifier = computed(() =>
    this.tone() === 'primary' ? '' : `kpi__icon--${this.tone()}`,
  );
}
