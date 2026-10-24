import { Component, input, output } from '@angular/core';
import { Button, Icon, Spinner } from '@lms/ui';
import type { ActionCard as ActionCardState } from '../../../../core/assistant/agent-chat.model';

/**
 * A change the assistant proposed, shown as "label: old → new" per field. Nothing has happened
 * until the user clicks "Xác nhận". It renders what the store tells it and reports the click.
 */
@Component({
  selector: 'app-action-card',
  imports: [Button, Icon, Spinner],
  templateUrl: './action-card.html',
  styleUrl: './action-card.scss',
})
export class ActionCard {
  readonly card = input.required<ActionCardState>();
  /** Another card (or this one) is being confirmed: one at a time. */
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
