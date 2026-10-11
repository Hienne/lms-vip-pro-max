import { booleanAttribute, Component, input } from '@angular/core';
import { Mai } from '../mai/mai';

/**
 * Reward badge: a hoa mai in a round plate with its name and description.
 * Earned and locked differ by more than colour: a locked badge says "Chưa mở khóa" in text,
 * an earned one is announced as "Đã mở khóa".
 */
@Component({
  selector: 'ui-mai-badge',
  imports: [Mai],
  host: {
    class: 'flex flex-col items-center gap-2 text-center',
    '[attr.title]': 'description()',
  },
  template: `
    <div
      class="mai-badge"
      [class.is-locked]="!earned()"
      [class.animate-reward-pop]="earned()"
    >
      <ui-mai [size]="40" />
    </div>
    <div class="text-sm font-semibold">{{ name() }}</div>
    <div class="mai-badge__desc text-xs text-text-muted">
      @if (earned()) {
        <span class="sr-only">Đã mở khóa · </span>{{ description() }}
      } @else {
        Chưa mở khóa · {{ description() }}
      }
    </div>
  `,
})
export class MaiBadge {
  readonly name = input.required<string>();
  readonly description = input.required<string>();
  readonly earned = input(false, { transform: booleanAttribute });
}
