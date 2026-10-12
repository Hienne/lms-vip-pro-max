import { Component, computed, input } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export type EmptyTone = 'primary' | 'warning' | 'danger';
export type EmptyHeadingLevel = 2 | 3 | 4;

/**
 * A centred block for "nothing here" and for failures: a round icon, a title, an optional
 * description and a slot for the action(s). The heading level is configurable so the block fits the
 * page outline. The icon is decorative; the title carries the meaning.
 */
@Component({
  selector: 'ui-empty',
  imports: [Icon],
  host: { class: 'empty animate-enter' },
  template: `
    <div class="empty__art" [class]="artClass()">
      <ui-icon [name]="icon()" size="xl" />
    </div>
    @switch (headingLevel()) {
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
    @if (description()) {
      <p>{{ description() }}</p>
    }
    <ng-content />
  `,
})
export class Empty {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly description = input('');
  readonly tone = input<EmptyTone>('primary');
  readonly headingLevel = input<EmptyHeadingLevel>(3);

  protected readonly artClass = computed(() =>
    this.tone() === 'primary' ? '' : `empty__art--${this.tone()}`,
  );
}
