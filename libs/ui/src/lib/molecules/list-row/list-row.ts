import { booleanAttribute, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';
import { ListItem } from '../../atoms/list/list-item.directive';

export type ListRowTone = 'default' | 'danger';

/**
 * A link row for a `<ul uiList>`: an optional plain leading icon (no tile), a title, an optional
 * muted subtitle, and an optional trailing value or chevron. Wrap it in the `<li>`:
 * `<li><ui-list-row link="/saved" icon="bookmark" title="Ghi chú" subtitle="…" chevron /></li>`.
 * The subtitle is the input, or projected as `slot="subtitle"` for a component such as a due date.
 * `tone="danger"` colours the icon and is for an overdue or failed row only.
 */
@Component({
  selector: 'ui-list-row',
  imports: [RouterLink, Icon, ListItem],
  host: { class: 'list-row' },
  template: `
    <a uiListItem [routerLink]="link()" [queryParams]="queryParams()">
      @if (icon(); as name) {
        <span
          class="list-row__icon list__icon"
          [class.list-row__icon--danger]="tone() === 'danger'"
        >
          <ui-icon [name]="name" size="sm" />
        </span>
      }
      <span class="list-row__text">
        <span class="list-row__title">{{ title() }}</span>
        @if (subtitle(); as subtitle) {
          <span class="list-row__subtitle">{{ subtitle }}</span>
        }
        <ng-content select="[slot=subtitle]" />
      </span>
      @if (value() !== undefined) {
        <span class="list-row__value">{{ value() }}</span>
      }
      @if (chevron()) {
        <ui-icon class="list-row__chevron" name="chevron-right" size="sm" />
      }
    </a>
  `,
})
export class ListRow {
  readonly title = input.required<string>();
  /** In-app router path or commands. */
  readonly link = input.required<string | readonly unknown[]>();
  readonly queryParams = input<Record<string, string>>();
  readonly icon = input<IconName>();
  readonly tone = input<ListRowTone>('default');
  readonly subtitle = input<string>();
  readonly value = input<string | number>();
  readonly chevron = input(false, { transform: booleanAttribute });
}
