import { Component, computed, input } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export type EmptyTone = 'primary' | 'warning' | 'danger';
export type EmptyHeadingLevel = 1 | 2 | 3 | 4;
export type EmptyVariant = 'page' | 'inline';

/**
 * "Nothing here" and failures, left-aligned (visual-design.md).
 * - `page` (default): a heading with an optional icon beside it, an optional description and a
 *   slot for the action(s). The heading level is configurable so the block fits the page outline;
 *   the icon is decorative and the tone only colours it.
 * - `inline` (inside a card, a table or a tab): one muted line (the title, then the description)
 *   and the projected action. No heading and no icon.
 */
@Component({
  selector: 'ui-empty',
  imports: [Icon],
  host: { class: 'empty', '[class.empty--inline]': "variant() === 'inline'" },
  template: `
    @if (variant() === 'inline') {
      <p class="empty__line">{{ line() }}</p>
    } @else {
      <div class="empty__title">
        @if (icon(); as name) {
          <ui-icon class="empty__icon" [class]="iconClass()" [name]="name" />
        }
        @switch (headingLevel()) {
          @case (1) {
            <h1>{{ title() }}</h1>
          }
          @case (2) {
            <h2>{{ title() }}</h2>
          }
          @case (4) {
            <h4>{{ title() }}</h4>
          }
          @default {
            <h3>{{ title() }}</h3>
          }
        }
      </div>
      @if (description()) {
        <p>{{ description() }}</p>
      }
    }
    <ng-content />
  `,
})
export class Empty {
  readonly icon = input<IconName>();
  readonly title = input.required<string>();
  readonly description = input('');
  readonly tone = input<EmptyTone>('primary');
  readonly headingLevel = input<EmptyHeadingLevel>(3);
  readonly variant = input<EmptyVariant>('page');

  protected readonly line = computed(() =>
    [this.title(), this.description()].filter(Boolean).join('. '),
  );
  protected readonly iconClass = computed(() =>
    this.tone() === 'primary' ? '' : `empty__icon--${this.tone()}`,
  );
}
