import { Component, computed, input, output } from '@angular/core';
import { Button, Spinner } from '@lms/ui';
import type { ActionCard as ActionCardState } from '../../../../core/assistant/agent-chat.model';

/**
 * A change the assistant proposed, asked as a question ("Đổi chức danh?") with the current and the
 * new value side by side. Nothing has happened until the user clicks "Xác nhận"; once the card is
 * settled it gives way to one line with the result. It renders what the store tells it and reports
 * the click.
 */
@Component({
  selector: 'app-action-card',
  imports: [Button, Spinner],
  templateUrl: './action-card.html',
  styleUrl: './action-card.scss',
})
export class ActionCard {
  readonly card = input.required<ActionCardState>();
  /** Another card (or this one) is being confirmed: one at a time. */
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  /** More than one field changes, so each one is named above its values. */
  protected readonly several = computed(
    () => this.card().pending.changes.length > 1,
  );

  /** One field names itself in the question; several are asked by the server's title. */
  protected readonly question = computed(() => {
    const { title, changes } = this.card().pending;
    if (changes.length > 1) return `${title}?`;
    const label = changes[0].label;
    return `Đổi ${label.charAt(0).toLocaleLowerCase('vi') + label.slice(1)}?`;
  });
}
